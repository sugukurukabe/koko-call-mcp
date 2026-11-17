#!/usr/bin/env bash
# Stage 1: Clean-clone, Cloud Build digest-pinned 0% traffic candidate deploy,
# authoritative v1 + v2 Service GET binding (with monotonic bounded RPCs),
# config-preservation diff, strict fail-closed journal persistence, and full
# zero-KKJ-traffic runtime verification. Zero traffic shifts are performed in Stage 1.

set -u -o pipefail

export CLOUDSDK_METRICS_ENVIRONMENT="${CLOUDSDK_METRICS_ENVIRONMENT:+$CLOUDSDK_METRICS_ENVIRONMENT }datacloud.antigravity"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="stage1-deploy-0pct-candidate.sh"
readonly CLOUDRUN_API_ORIGIN="https://run.googleapis.com"
readonly CHILD_TERM_GRACE_SEC="0.250"

# PUBLIC-V3-F03: Reject any non-Google CLOUDRUN_API_BASE override BEFORE token acquisition
if [[ -v CLOUDRUN_API_BASE && "$CLOUDRUN_API_BASE" != "$CLOUDRUN_API_ORIGIN" ]]; then
  echo "[stage1] [NON_GOOGLE_API_OVERRIDE] CLOUDRUN_API_BASE override is forbidden: '$CLOUDRUN_API_BASE'" >&2
  exit 23
fi

GCP_PROJECT="${GCP_PROJECT:-}"
GCP_REGION="${GCP_REGION:-}"
SERVICE_NAME="${SERVICE_NAME:-}"
REPO_URL="${REPO_URL:-}"
TARGET_SHA="${TARGET_SHA:-}"
IMAGE_REPO="${IMAGE_REPO:-}"
CAND_REVISION_SUFFIX="${CAND_REVISION_SUFFIX:-}"
CAND_TAG="${CAND_TAG:-}"
EXPECTED_VERSION="${EXPECTED_VERSION:-0.10.1}"
EXPECTED_UI_HTML_SHA256="${EXPECTED_UI_HTML_SHA256:-}"
EXPECTED_CHALLENGE_TOKEN="${EXPECTED_CHALLENGE_TOKEN:-}"
RPC_TIMEOUT_SECONDS="${RPC_TIMEOUT_SECONDS:-30}"
WORK_DIR="${WORK_DIR:-}"

for arg in "$@"; do
  case "$arg" in
    --project=*) GCP_PROJECT="${arg#*=}" ;;
    --region=*) GCP_REGION="${arg#*=}" ;;
    --service=*) SERVICE_NAME="${arg#*=}" ;;
    --repo-url=*) REPO_URL="${arg#*=}" ;;
    --target-sha=*) TARGET_SHA="${arg#*=}" ;;
    --image-repo=*) IMAGE_REPO="${arg#*=}" ;;
    --candidate-suffix=*) CAND_REVISION_SUFFIX="${arg#*=}" ;;
    --candidate-tag=*) CAND_TAG="${arg#*=}" ;;
    --expected-version=*) EXPECTED_VERSION="${arg#*=}" ;;
    --expected-ui-sha256=*) EXPECTED_UI_HTML_SHA256="${arg#*=}" ;;
    --expected-challenge-token=*) EXPECTED_CHALLENGE_TOKEN="${arg#*=}" ;;
    --rpc-timeout-seconds=*) RPC_TIMEOUT_SECONDS="${arg#*=}" ;;
    --work-dir=*) WORK_DIR="${arg#*=}" ;;
    --cloudrun-api-base=*)
      echo "[stage1] [NON_GOOGLE_API_OVERRIDE] --cloudrun-api-base override is forbidden" >&2
      exit 23
      ;;
    *)
      echo "[stage1] Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$GCP_PROJECT" || -z "$GCP_REGION" || -z "$SERVICE_NAME" || -z "$REPO_URL" || -z "$TARGET_SHA" || -z "$IMAGE_REPO" || -z "$CAND_REVISION_SUFFIX" || -z "$CAND_TAG" || -z "$EXPECTED_UI_HTML_SHA256" || -z "$WORK_DIR" ]]; then
  echo "[stage1] Missing required parameter(s)." >&2
  exit 2
fi

if [[ ! "$RPC_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]] || (( 10#$RPC_TIMEOUT_SECONDS < 1 || 10#$RPC_TIMEOUT_SECONDS > 600 )); then
  echo "[stage1] [INVALID_RPC_TIMEOUT_SECONDS] --rpc-timeout-seconds must be in [1, 600]; got '$RPC_TIMEOUT_SECONDS'" >&2
  exit 22
fi

if [[ ! "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "[stage1] Invalid --target-sha (must be 40 lowercase hex chars): $TARGET_SHA" >&2
  exit 2
fi

if [[ ! "$CAND_REVISION_SUFFIX" =~ ^[a-z0-9][a-z0-9-]{1,30}$ ]]; then
  echo "[stage1] Invalid --candidate-suffix: $CAND_REVISION_SUFFIX" >&2
  exit 2
fi

if [[ ! "$CAND_TAG" =~ ^[a-z][a-z0-9-]{1,30}$ ]]; then
  echo "[stage1] Invalid --candidate-tag: $CAND_TAG" >&2
  exit 2
fi

if [[ ! "$EXPECTED_UI_HTML_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "[stage1] Invalid --expected-ui-sha256: $EXPECTED_UI_HTML_SHA256" >&2
  exit 2
fi

if ! mkdir -p "$WORK_DIR"; then
  echo "[stage1] Failed to create WORK_DIR: $WORK_DIR" >&2
  exit 3
fi

JOURNAL_FILE="$WORK_DIR/phase-journal.json"
MUTATING_RPC_SENT=0

STEP_OWNERSHIP_SEQ=0

assert_proc_capability() {
  local self_pid="${BASHPID:-$$}"
  if [[ ! -d /proc || ! -r "/proc/${self_pid}/stat" || ! -r "/proc/${self_pid}/environ" ]]; then
    echo "[$SCRIPT_NAME] [PROC_CAPABILITY_UNAVAILABLE] /proc/${self_pid}/stat and /proc/${self_pid}/environ are required for bounded child cleanup" >&2
    exit 38
  fi
}

monotonic_now_ms() {
  if [[ -r /proc/uptime ]]; then
    local up rest sec frac
    read -r up rest < /proc/uptime
    sec="${up%%.*}"
    frac="${up#*.}"
    frac="${frac}000"
    frac="${frac:0:3}"
    printf '%s\n' "$(( 10#$sec * 1000 + 10#$frac ))"
  else
    node -e 'process.stdout.write(String(Math.floor(Number(process.hrtime.bigint() / 1000000n))))'
  fi
}

format_ms_as_positive_sec() {
  local ms="$1"
  if (( ms <= 0 )); then
    ms=1
  fi
  printf '%d.%03d' $(( ms / 1000 )) $(( ms % 1000 ))
}

read_proc_stat_ppid_pgid() {
  local pid="$1"
  local stat_line=""
  IFS= read -r stat_line < "/proc/${pid}/stat" 2>/dev/null || return 1
  local after_comm="${stat_line##*) }"
  local _state="" p_ppid="" p_pgid="" _rest=""
  read -r _state p_ppid p_pgid _rest <<< "$after_comm"
  if [[ "$p_ppid" =~ ^[0-9]+$ && "$p_pgid" =~ ^[0-9]+$ ]]; then
    printf '%s %s\n' "$p_ppid" "$p_pgid"
    return 0
  fi
  return 1
}

proc_has_env_token() {
  local pid="$1"
  local token="$2"
  [[ -r "/proc/${pid}/environ" ]] || return 1
  tr '\0' '\n' < "/proc/${pid}/environ" 2>/dev/null | grep -Fqx "JP_BIDS_OWNED_STEP_TOKEN=${token}"
}

collect_owned_pids() {
  local token="$1"
  local cmd_pgid="$2"
  local my_pgid="$3"
  local wd_pid="$4"
  local sleep_pid="$5"
  local cmd_pid="$6"

  local -A ancestors=()
  local cur="${BASHPID:-$$}"
  local hop=0
  while [[ "$cur" =~ ^[0-9]+$ ]] && (( cur > 1 && hop < 64 )); do
    ancestors["$cur"]=1
    local pair=""
    if pair="$(read_proc_stat_ppid_pgid "$cur")"; then
      cur="${pair%% *}"
    else
      break
    fi
    hop=$(( hop + 1 ))
  done
  ancestors["$$"]=1
  if [[ -n "$wd_pid" ]]; then ancestors["$wd_pid"]=1; fi
  if [[ -n "$sleep_pid" ]]; then ancestors["$sleep_pid"]=1; fi

  local -A proc_ppid=()
  local -A owned=()
  local all_pids=()
  local entry="" pid="" pair="" p_ppid="" p_pgid=""

  for entry in /proc/[0-9]*; do
    pid="${entry#/proc/}"
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    [[ -n "${ancestors[$pid]:-}" ]] && continue
    if pair="$(read_proc_stat_ppid_pgid "$pid")"; then
      p_ppid="${pair%% *}"
      p_pgid="${pair#* }"
      proc_ppid["$pid"]="$p_ppid"
      all_pids+=("$pid")
      if [[ "$pid" == "$cmd_pid" ]]; then
        owned["$pid"]=1
      elif [[ "$cmd_pgid" =~ ^[0-9]+$ && "$cmd_pgid" -gt 1 && "$cmd_pgid" != "$my_pgid" && "$p_pgid" == "$cmd_pgid" ]]; then
        owned["$pid"]=1
      elif proc_has_env_token "$pid" "$token"; then
        owned["$pid"]=1
      fi
    fi
  done

  local changed=1
  local depth=0
  while (( changed == 1 && depth < 16 )); do
    changed=0
    for pid in "${all_pids[@]}"; do
      [[ -n "${owned[$pid]:-}" ]] && continue
      p_ppid="${proc_ppid[$pid]:-}"
      if [[ -n "$p_ppid" && -n "${owned[$p_ppid]:-}" ]]; then
        owned["$pid"]=1
        changed=1
      fi
    done
    depth=$(( depth + 1 ))
  done

  for pid in "${!owned[@]}"; do
    printf '%s\n' "$pid"
  done
}

signal_owned_pids() {
  local sig="$1"
  local cmd_pgid="$2"
  local my_pgid="$3"
  shift 3
  local pid=""
  for pid in "$@"; do
    [[ -n "$pid" ]] && kill "-$sig" "$pid" 2>/dev/null || :
  done
  if [[ "$cmd_pgid" =~ ^[0-9]+$ && "$cmd_pgid" -gt 1 && "$cmd_pgid" != "$my_pgid" ]]; then
    kill "-$sig" -- "-$cmd_pgid" 2>/dev/null || :
  fi
}

run_bounded_step() {
  local timeout_ms="$1"
  local stdout_file="$2"
  shift 2
  if (( timeout_ms <= 0 )); then
    return 124
  fi
  assert_proc_capability
  local timeout_sec
  timeout_sec="$(format_ms_as_positive_sec "$timeout_ms")"

  STEP_OWNERSHIP_SEQ=$(( STEP_OWNERSHIP_SEQ + 1 ))
  local step_token="jpbids-$$-${BASHPID:-0}-${STEP_OWNERSHIP_SEQ}-$(monotonic_now_ms)"
  local meta_base="${WORK_DIR:-${TMPDIR:-/tmp}}"
  local step_meta_dir=""
  step_meta_dir="$(mktemp -d "${meta_base%/}/jpbids-step-XXXXXX" 2>/dev/null || mktemp -d)"
  local timeout_flag="$step_meta_dir/timed_out"
  local pgid_file="$step_meta_dir/cmd_pgid"

  local self_pid="${BASHPID:-$$}"
  local self_pair="" my_pgid=""
  if self_pair="$(read_proc_stat_ppid_pgid "$self_pid")"; then
    my_pgid="${self_pair#* }"
  fi

  (
    export JP_BIDS_OWNED_STEP_TOKEN="$step_token"
    set -m
    "$@" &
    child_pid=$!
    if child_pair="$(read_proc_stat_ppid_pgid "$child_pid")"; then
      printf '%s\n' "${child_pair#* }" > "$pgid_file"
    fi
    trap 'kill -TERM "$child_pid" 2>/dev/null || :' TERM INT
    wait "$child_pid" 2>/dev/null
    exit $?
  ) > "$stdout_file" &
  local cmd_pid=$!

  (
    sleep_pid=""
    trap 'if [[ -n "$sleep_pid" ]]; then kill -TERM "$sleep_pid" 2>/dev/null || :; kill -KILL "$sleep_pid" 2>/dev/null || :; fi; exit 0' TERM INT
    sleep "$timeout_sec" >/dev/null 2>&1 &
    sleep_pid=$!
    wait "$sleep_pid" 2>/dev/null || :
    sleep_pid=""

    local cmd_pgid=""
    if [[ -r "$pgid_file" ]]; then
      IFS= read -r cmd_pgid < "$pgid_file" 2>/dev/null || cmd_pgid=""
    fi
    local initial_owned=()
    mapfile -t initial_owned < <(collect_owned_pids "$step_token" "$cmd_pgid" "$my_pgid" "${BASHPID:-0}" "" "$cmd_pid")

    if kill -0 "$cmd_pid" 2>/dev/null || (( ${#initial_owned[@]} > 0 )); then
      : > "$timeout_flag"
      signal_owned_pids TERM "$cmd_pgid" "$my_pgid" "${initial_owned[@]}"
      kill -TERM "$cmd_pid" 2>/dev/null || :

      sleep "$CHILD_TERM_GRACE_SEC" >/dev/null 2>&1 &
      sleep_pid=$!
      wait "$sleep_pid" 2>/dev/null || :
      sleep_pid=""

      if [[ -r "$pgid_file" ]]; then
        IFS= read -r cmd_pgid < "$pgid_file" 2>/dev/null || cmd_pgid=""
      fi
      local remaining_owned=()
      mapfile -t remaining_owned < <(collect_owned_pids "$step_token" "$cmd_pgid" "$my_pgid" "${BASHPID:-0}" "" "$cmd_pid")
      signal_owned_pids KILL "$cmd_pgid" "$my_pgid" "${remaining_owned[@]}"
      kill -KILL "$cmd_pid" 2>/dev/null || :

      local reap_iter=0
      while (( reap_iter < 50 )); do
        mapfile -t remaining_owned < <(collect_owned_pids "$step_token" "$cmd_pgid" "$my_pgid" "${BASHPID:-0}" "" "$cmd_pid")
        if (( ${#remaining_owned[@]} == 0 )); then
          break
        fi
        signal_owned_pids KILL "$cmd_pgid" "$my_pgid" "${remaining_owned[@]}"
        sleep 0.02 >/dev/null 2>&1 || :
        reap_iter=$(( reap_iter + 1 ))
      done
    fi
  ) >/dev/null 2>&1 &
  local wd_pid=$!

  wait "$cmd_pid" 2>/dev/null
  local rc=$?

  local timed_out=0
  if [[ -f "$timeout_flag" ]]; then
    timed_out=1
    wait "$wd_pid" 2>/dev/null || :
  else
    kill -TERM "$wd_pid" 2>/dev/null || :
    wait "$wd_pid" 2>/dev/null || :
  fi

  local final_pgid=""
  if [[ -r "$pgid_file" ]]; then
    IFS= read -r final_pgid < "$pgid_file" 2>/dev/null || final_pgid=""
  fi
  local stray_owned=()
  mapfile -t stray_owned < <(collect_owned_pids "$step_token" "$final_pgid" "$my_pgid" "$wd_pid" "" "$cmd_pid")
  if (( ${#stray_owned[@]} > 0 )); then
    signal_owned_pids KILL "$final_pgid" "$my_pgid" "${stray_owned[@]}"
  fi

  rm -rf "$step_meta_dir" 2>/dev/null || :

  if (( timed_out == 1 )) || [[ "$rc" -eq 143 || "$rc" -eq 137 ]]; then
    return 124
  fi
  return "$rc"
}

assert_proc_capability

journal_event() {
  local phase="$1"
  local status="$2"
  local detail="$3"
  local outcome="${4:-}"
  local rc="${5:-}"
  local obs_svc="${6:-}"
  local extra_args=()
  if [[ -n "$outcome" ]]; then
    extra_args+=("--outcome=$outcome")
  fi
  if [[ -n "$rc" ]]; then
    extra_args+=("--exit-code=$rc")
  fi
  if [[ -n "$obs_svc" ]]; then
    extra_args+=("--service-json=$obs_svc")
  fi
  if ! node "$SCRIPT_DIR/cloudrun-state-guard.mjs" journal \
    --journal-json="$JOURNAL_FILE" \
    --script="$SCRIPT_NAME" \
    --phase="$phase" \
    --status="$status" \
    --detail="$detail" \
    --traffic-mutations=0 \
    --rollback-attempts=0 \
    "${extra_args[@]}"; then
    return 19
  fi
  return 0
}

abort_on_journal_failure() {
  local j_rc=${1:-19}
  local phase="$2"
  if [[ "$j_rc" -eq 0 ]]; then
    j_rc=19
  fi
  rm -f "$WORK_DIR/stage1-verified-receipt.json"
  if [[ "$MUTATING_RPC_SENT" -eq 0 ]]; then
    echo "[stage1] [JOURNAL_PERSIST_FAILED_BEFORE_RPC] Failed to persist journal at $phase (rc=$j_rc); aborting with 0 mutating RPCs" >&2
  else
    echo "[stage1] [UNKNOWN_OR_MAY_HAVE_STARTED] Journal persistence failed at $phase after mutating RPC (rc=$j_rc); halting without receipt or further mutations" >&2
    printf '{"ok":false,"outcome":"UNKNOWN_OR_MAY_HAVE_STARTED","phase":"%s","journalExitCode":%d}\n' "$phase" "$j_rc" > "$WORK_DIR/stage1-journal-failure-marker.json" 2>/dev/null
  fi
  exit "$j_rc"
}

fetch_v2_service_json() {
  local out_file="$1"
  local svc_url="${CLOUDRUN_API_ORIGIN}/v2/projects/${GCP_PROJECT}/locations/${GCP_REGION}/services/${SERVICE_NAME}"
  if ! node "$SCRIPT_DIR/cloudrun-state-guard.mjs" validate-api-url \
    --url="$svc_url" \
    --project="$GCP_PROJECT" \
    --region="$GCP_REGION" \
    --service="$SERVICE_NAME" \
    --kind=service; then
    return 23
  fi
  local start_ms
  start_ms="$(monotonic_now_ms)"
  local deadline_ms=$(( start_ms + RPC_TIMEOUT_SECONDS * 1000 ))
  local rem_ms=$(( deadline_ms - $(monotonic_now_ms) ))
  if (( rem_ms <= 0 )); then
    return 37
  fi
  local tok_file="$WORK_DIR/.s1-token.tmp"
  if ! run_bounded_step "$rem_ms" "$tok_file" gcloud auth print-access-token; then
    rm -f "$tok_file"
    return 33
  fi
  local access_token
  access_token="$(cat "$tok_file")"
  rm -f "$tok_file"

  rem_ms=$(( deadline_ms - $(monotonic_now_ms) ))
  if (( rem_ms <= 0 )); then
    return 37
  fi
  local curl_max_time
  curl_max_time="$(format_ms_as_positive_sec "$rem_ms")"
  local code_file="$WORK_DIR/.s1-http-code.tmp"
  if run_bounded_step "$rem_ms" "$code_file" curl -sS --max-time "$curl_max_time" -o "$out_file" -w "%{http_code}" -X GET "$svc_url" \
    -H "Authorization: Bearer ${access_token}"; then
    :
  else
    local curl_rc=$?
    rm -f "$code_file"
    return "$curl_rc"
  fi
  local http_code
  http_code="$(cat "$code_file")"
  rm -f "$code_file"
  if (( $(monotonic_now_ms) >= deadline_ms )); then
    return 37
  fi
  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    echo "[stage1] v2 Service GET returned HTTP $http_code" >&2
    return 34
  fi
  return 0
}

if ! journal_event "S1_INIT" "STARTED" "Stage 1 0% candidate deployment initialized"; then
  abort_on_journal_failure "$?" "S1_INIT"
fi

# Step 1: Pre-Stage 1 read-only v1 + authoritative v2 Service GET & snapshot
if gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format=json > "$WORK_DIR/pre-service.json"; then
  :
else
  rc=$?
  journal_event "S1_PRE_DESCRIBE" "FAILED" "Pre-Stage 1 gcloud run services describe failed" "PRE_DESCRIBE_FAILED" "$rc" || :
  exit "$rc"
fi

if fetch_v2_service_json "$WORK_DIR/pre-v2-service.json"; then
  :
else
  rc=$?
  journal_event "S1_PRE_V2_DESCRIBE" "FAILED" "Pre-Stage 1 Cloud Run v2 Service GET failed" "PRE_V2_DESCRIBE_FAILED" "$rc" || :
  exit "$rc"
fi

if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" pre-stage1 \
  --service-json="$WORK_DIR/pre-service.json" \
  --v2-service-json="$WORK_DIR/pre-v2-service.json" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --service="$SERVICE_NAME" \
  --candidate-tag="$CAND_TAG" \
  --snapshot-out="$WORK_DIR/pre-stage1-service-snapshot.json" \
  --env-out="$WORK_DIR/stage1-pre.env"; then
  :
else
  rc=$?
  journal_event "S1_PRE_STATE_GUARD" "FAILED" "Pre-Stage 1 state guard rejected live v1/v2 service snapshot" "PRE_STATE_GUARD_REJECTED" "$rc" || :
  exit "$rc"
fi

# shellcheck disable=SC1091
source "$WORK_DIR/stage1-pre.env"
if ! journal_event "S1_PRE_STATE_GUARD" "OK" "Locked uid=$SERVICE_UID, prev100Revision=$PREV_100_REVISION at generation=$BASE_GENERATION"; then
  abort_on_journal_failure "$?" "S1_PRE_STATE_GUARD"
fi

# Step 2: Clean git clone & exact SHA checkout (zero GCP mutations on failure)
SRC_DIR="$WORK_DIR/clean-src"
rm -rf "$SRC_DIR"

if git clone --no-checkout "$REPO_URL" "$SRC_DIR" && git -C "$SRC_DIR" checkout --detach "$TARGET_SHA"; then
  ACTUAL_HEAD="$(git -C "$SRC_DIR" rev-parse HEAD)"
  if [[ "$ACTUAL_HEAD" != "$TARGET_SHA" ]]; then
    journal_event "S1_GIT_CLONE_CHECKOUT" "FAILED" "Checked out HEAD ($ACTUAL_HEAD) !== TARGET_SHA ($TARGET_SHA)" "CLONE_SHA_MISMATCH" "14" || :
    exit 14
  fi
else
  rc=$?
  journal_event "S1_GIT_CLONE_CHECKOUT" "FAILED" "git clone or checkout failed with zero GCP mutations" "CLONE_FAILED" "$rc" || :
  exit "$rc"
fi
if ! journal_event "S1_GIT_CLONE_CHECKOUT" "OK" "Verified clean source checkout at $TARGET_SHA"; then
  abort_on_journal_failure "$?" "S1_GIT_CLONE_CHECKOUT"
fi

# Step 3: Cloud Build image submission & immutable sha256 digest extraction
IMAGE_TAG_URI="${IMAGE_REPO}:cand-${TARGET_SHA:0:12}-${CAND_REVISION_SUFFIX}"
if ! journal_event "S1_CLOUD_BUILD" "STARTING" "Submitting Cloud Build for $IMAGE_TAG_URI"; then
  abort_on_journal_failure "$?" "S1_CLOUD_BUILD_STARTING"
fi

MUTATING_RPC_SENT=1
if gcloud builds submit \
  --project="$GCP_PROJECT" \
  --tag="$IMAGE_TAG_URI" \
  --format=json \
  "$SRC_DIR" > "$WORK_DIR/build-result.json"; then
  :
else
  rc=$?
  journal_event "S1_CLOUD_BUILD" "FAILED" "gcloud builds submit failed with zero Cloud Run mutations" "BUILD_FAILED" "$rc" || :
  exit "$rc"
fi

if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" extract-digest \
  --build-json="$WORK_DIR/build-result.json" \
  --env-out="$WORK_DIR/stage1-build.env"; then
  :
else
  rc=$?
  journal_event "S1_EXTRACT_DIGEST" "FAILED" "Cloud Build output lacked valid sha256 image digest" "BUILD_DIGEST_MISSING" "$rc" || :
  exit "$rc"
fi

# shellcheck disable=SC1091
source "$WORK_DIR/stage1-build.env"
if ! journal_event "S1_CLOUD_BUILD" "OK" "Built immutable image digest $BUILT_IMAGE_DIGEST"; then
  abort_on_journal_failure "$?" "S1_CLOUD_BUILD_OK"
fi

# Step 4: Deploy 0% traffic candidate with deterministic revision suffix & tag
CAND_REVISION="${SERVICE_NAME}-${CAND_REVISION_SUFFIX}"
PINNED_IMAGE_REF="${IMAGE_REPO}@${BUILT_IMAGE_DIGEST}"

if ! journal_event "S1_DEPLOY_0PCT" "INITIATED" "Initiating 0% traffic deploy of $CAND_REVISION ($PINNED_IMAGE_REF)"; then
  abort_on_journal_failure "$?" "S1_DEPLOY_0PCT_STARTING"
fi

if gcloud run deploy "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --image="$PINNED_IMAGE_REF" \
  --revision-suffix="$CAND_REVISION_SUFFIX" \
  --no-traffic \
  --tag="$CAND_TAG" \
  --format=json > "$WORK_DIR/deploy-result.json"; then
  :
else
  rc=$?
  OBS_FILE="$WORK_DIR/deploy-unknown-service.json"
  if gcloud run services describe "$SERVICE_NAME" \
    --project="$GCP_PROJECT" \
    --region="$GCP_REGION" \
    --format=json > "$OBS_FILE"; then
    journal_event "S1_DEPLOY_0PCT" "HALTED" "0% deploy returned non-zero ($rc); queried live state and halted without retry or traffic change" "OUTCOME_UNKNOWN_HALTED" "$rc" "$OBS_FILE" || :
  else
    desc_rc=$?
    journal_event "S1_DEPLOY_0PCT" "HALTED" "0% deploy returned non-zero ($rc) and follow-up describe returned $desc_rc; halted without retry or traffic change" "OUTCOME_UNKNOWN_HALTED" "$rc" || :
  fi
  exit "$rc"
fi

# Step 5: Post-deploy v1 + authoritative v2 state & config-preservation diff
if gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format=json > "$WORK_DIR/post-stage1-service.json"; then
  :
else
  rc=$?
  journal_event "S1_POST_DESCRIBE" "FAILED" "Post-deploy v1 service describe failed" "POST_DESCRIBE_FAILED" "$rc" || :
  exit "$rc"
fi

if fetch_v2_service_json "$WORK_DIR/post-stage1-v2-service.json"; then
  :
else
  rc=$?
  journal_event "S1_POST_V2_DESCRIBE" "FAILED" "Post-deploy v2 Service GET failed" "POST_V2_DESCRIBE_FAILED" "$rc" || :
  exit "$rc"
fi

if gcloud run revisions describe "$CAND_REVISION" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format=json > "$WORK_DIR/cand-revision.json"; then
  :
else
  rc=$?
  journal_event "S1_REVISION_DESCRIBE" "FAILED" "Candidate revision describe ($CAND_REVISION) failed" "REVISION_DESCRIBE_FAILED" "$rc" || :
  exit "$rc"
fi

if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" post-stage1-diff \
  --snapshot-json="$WORK_DIR/pre-stage1-service-snapshot.json" \
  --service-json="$WORK_DIR/post-stage1-service.json" \
  --v2-service-json="$WORK_DIR/post-stage1-v2-service.json" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --service="$SERVICE_NAME" \
  --revision-json="$WORK_DIR/cand-revision.json" \
  --expected-revision="$CAND_REVISION" \
  --candidate-tag="$CAND_TAG" \
  --expected-digest="$BUILT_IMAGE_DIGEST" \
  --diff-out="$WORK_DIR/stage1-config-preservation-diff.json" \
  --env-out="$WORK_DIR/stage1-post.env"; then
  :
else
  rc=$?
  journal_event "S1_POST_STATE_DIFF" "FAILED" "Post-Stage 1 invariant or config preservation check failed" "STAGE1_INVARIANT_OR_CONFIG_DRIFT_FAILED" "$rc" || :
  exit "$rc"
fi

# shellcheck disable=SC1091
source "$WORK_DIR/stage1-post.env"
if ! journal_event "S1_POST_STATE_DIFF" "OK" "Verified $CAND_REVISION at 0% ($CAND_URL) and $PREV_100_REVISION still at 100%"; then
  abort_on_journal_failure "$?" "S1_POST_STATE_DIFF"
fi

# Step 6: Full zero-KKJ-traffic OAuth + Authenticated MCP (2025-11-25 & 2026-07-28) + UI hash verification
if node "$SCRIPT_DIR/verify-cloudrun-candidate.mjs" \
  --base-url="$CAND_URL" \
  --expected-version="$EXPECTED_VERSION" \
  --expected-ui-sha256="$EXPECTED_UI_HTML_SHA256" \
  --expected-challenge-token="$EXPECTED_CHALLENGE_TOKEN" \
  --out-json="$WORK_DIR/stage1-candidate-verification.json"; then
  :
else
  rc=$?
  journal_event "S1_RUNTIME_VERIFY" "FAILED" "Candidate runtime verification failed on $CAND_URL" "STAGE1_CANDIDATE_VERIFICATION_FAILED" "$rc" || :
  exit "$rc"
fi

# Step 7: Seal Stage 1 verified receipt & persist final journal
if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" seal-stage1-receipt \
  --snapshot-json="$WORK_DIR/pre-stage1-service-snapshot.json" \
  --diff-json="$WORK_DIR/stage1-config-preservation-diff.json" \
  --verify-json="$WORK_DIR/stage1-candidate-verification.json" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --service="$SERVICE_NAME" \
  --target-sha="$TARGET_SHA" \
  --expected-version="$EXPECTED_VERSION" \
  --receipt-out="$WORK_DIR/stage1-verified-receipt.json"; then
  :
else
  rc=$?
  rm -f "$WORK_DIR/stage1-verified-receipt.json"
  journal_event "S1_SEAL_RECEIPT" "FAILED" "Failed to seal Stage 1 receipt" "SEAL_RECEIPT_FAILED" "$rc" || :
  exit "$rc"
fi

if ! journal_event "S1_COMPLETE" "OK" "Stage 1 0% deploy and verification complete; receipt sealed" "STAGE1_0PCT_VERIFIED" "0"; then
  abort_on_journal_failure "$?" "S1_COMPLETE"
fi
exit 0
