#!/usr/bin/env bash
# Stage 2: Strict max-age validation, hardcoded https://run.googleapis.com v2 Service GET
# binding (etag, uid, generation, trafficStatuses), atomic etag-preconditioned services.patch,
# monotonic-deadline-bounded Operation polling (shared across sleep, token acquisition, curl
# --max-time, 250ms child kill grace, and post-response deadline re-check), trafficStatuses
# convergence verification, full post-cutover verification on both candidate URL and production
# domain, strict fail-closed journal persistence, and identical v2 etag + Operation-tracked
# 1-shot rollback if needed.

set -u -o pipefail

export CLOUDSDK_METRICS_ENVIRONMENT="${CLOUDSDK_METRICS_ENVIRONMENT:+$CLOUDSDK_METRICS_ENVIRONMENT }datacloud.antigravity"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="stage2-promote-verified-candidate.sh"
readonly CLOUDRUN_API_ORIGIN="https://run.googleapis.com"
readonly CHILD_TERM_GRACE_SEC="0.250"

# PUBLIC-V3-F03: Reject any non-Google CLOUDRUN_API_BASE override BEFORE token acquisition
if [[ -v CLOUDRUN_API_BASE && "$CLOUDRUN_API_BASE" != "$CLOUDRUN_API_ORIGIN" ]]; then
  echo "[stage2] [NON_GOOGLE_API_OVERRIDE] CLOUDRUN_API_BASE override is forbidden: '$CLOUDRUN_API_BASE'" >&2
  exit 23
fi

RECEIPT_FILE="${RECEIPT_FILE:-}"
PRODUCTION_DOMAIN_URL="${PRODUCTION_DOMAIN_URL:-}"
if [[ -v MAX_AGE_SECONDS ]]; then
  MAX_AGE_SECONDS="$MAX_AGE_SECONDS"
elif [[ -v MAX_RECEIPT_AGE_SECONDS ]]; then
  MAX_AGE_SECONDS="$MAX_RECEIPT_AGE_SECONDS"
else
  MAX_AGE_SECONDS="900"
fi
OP_TIMEOUT_SECONDS="${OP_TIMEOUT_SECONDS:-180}"
OP_POLL_INTERVAL_MS="${OP_POLL_INTERVAL_MS:-1000}"
RPC_TIMEOUT_SECONDS="${RPC_TIMEOUT_SECONDS:-30}"
EXPECTED_CHALLENGE_TOKEN="${EXPECTED_CHALLENGE_TOKEN:-}"
WORK_DIR="${WORK_DIR:-}"

for arg in "$@"; do
  case "$arg" in
    --receipt=*) RECEIPT_FILE="${arg#*=}" ;;
    --production-url=*) PRODUCTION_DOMAIN_URL="${arg#*=}" ;;
    --max-age-seconds=*) MAX_AGE_SECONDS="${arg#*=}" ;;
    --max-receipt-age-seconds=*) MAX_AGE_SECONDS="${arg#*=}" ;;
    --op-timeout-seconds=*) OP_TIMEOUT_SECONDS="${arg#*=}" ;;
    --op-poll-interval-ms=*) OP_POLL_INTERVAL_MS="${arg#*=}" ;;
    --rpc-timeout-seconds=*) RPC_TIMEOUT_SECONDS="${arg#*=}" ;;
    --expected-challenge-token=*) EXPECTED_CHALLENGE_TOKEN="${arg#*=}" ;;
    --work-dir=*) WORK_DIR="${arg#*=}" ;;
    --cloudrun-api-base=*)
      echo "[stage2] [NON_GOOGLE_API_OVERRIDE] --cloudrun-api-base override is forbidden" >&2
      exit 23
      ;;
    *)
      echo "[stage2] Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$RECEIPT_FILE" || -z "$PRODUCTION_DOMAIN_URL" || -z "$WORK_DIR" ]]; then
  echo "[stage2] Missing required parameter(s) (--receipt, --production-url, --work-dir)." >&2
  exit 2
fi

# PUBLIC-V2-F03: Strict finite positive integer check in [1, 86400]
if [[ ! "$MAX_AGE_SECONDS" =~ ^[1-9][0-9]*$ ]] || (( 10#$MAX_AGE_SECONDS < 1 || 10#$MAX_AGE_SECONDS > 86400 )); then
  echo "[stage2] [INVALID_MAX_AGE_SECONDS] --max-age-seconds must be a finite positive integer in [1, 86400]; got '$MAX_AGE_SECONDS'" >&2
  exit 22
fi

if [[ ! "$OP_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]] || (( 10#$OP_TIMEOUT_SECONDS < 1 || 10#$OP_TIMEOUT_SECONDS > 600 )); then
  echo "[stage2] [INVALID_OP_TIMEOUT_SECONDS] --op-timeout-seconds must be in [1, 600]; got '$OP_TIMEOUT_SECONDS'" >&2
  exit 22
fi

if [[ ! "$OP_POLL_INTERVAL_MS" =~ ^[0-9]+$ ]] || (( 10#$OP_POLL_INTERVAL_MS > 10000 )); then
  echo "[stage2] [INVALID_OP_POLL_INTERVAL_MS] --op-poll-interval-ms must be in [0, 10000]; got '$OP_POLL_INTERVAL_MS'" >&2
  exit 22
fi

if [[ ! "$RPC_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]] || (( 10#$RPC_TIMEOUT_SECONDS < 1 || 10#$RPC_TIMEOUT_SECONDS > 600 )); then
  echo "[stage2] [INVALID_RPC_TIMEOUT_SECONDS] --rpc-timeout-seconds must be in [1, 600]; got '$RPC_TIMEOUT_SECONDS'" >&2
  exit 22
fi

if [[ ! -f "$RECEIPT_FILE" ]]; then
  echo "[stage2] Stage 1 receipt file not found: $RECEIPT_FILE" >&2
  exit 2
fi

if ! mkdir -p "$WORK_DIR"; then
  echo "[stage2] Failed to create WORK_DIR: $WORK_DIR" >&2
  exit 3
fi

JOURNAL_FILE="$WORK_DIR/phase-journal.json"
TRAFFIC_MUTATIONS=0
ROLLBACK_ATTEMPTS=0
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
    --traffic-mutations="$TRAFFIC_MUTATIONS" \
    --rollback-attempts="$ROLLBACK_ATTEMPTS" \
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
  rm -f "$WORK_DIR/stage2-promotion-complete.json"
  if [[ "$MUTATING_RPC_SENT" -eq 0 ]]; then
    echo "[stage2] [JOURNAL_PERSIST_FAILED_BEFORE_RPC] Failed to persist journal at $phase (rc=$j_rc); aborting with 0 mutating RPCs" >&2
  else
    echo "[stage2] [UNKNOWN_OR_MAY_HAVE_STARTED] Journal persistence failed at $phase after mutating RPC (rc=$j_rc); halting without completion JSON or further mutations" >&2
    printf '{"ok":false,"outcome":"UNKNOWN_OR_MAY_HAVE_STARTED","phase":"%s","journalExitCode":%d}\n' "$phase" "$j_rc" > "$WORK_DIR/stage2-journal-failure-marker.json" 2>/dev/null
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
  local tok_file="$WORK_DIR/.s2-get-token.tmp"
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
  local code_file="$WORK_DIR/.s2-get-code.tmp"
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
    echo "[stage2] v2 Service GET returned HTTP $http_code" >&2
    return 34
  fi
  return 0
}

atomic_patch_service_traffic() {
  local patch_payload_file="$1"
  local out_resp_file="$2"
  local out_code_file="$3"
  local patch_url="${CLOUDRUN_API_ORIGIN}/v2/projects/${GCP_PROJECT}/locations/${GCP_REGION}/services/${SERVICE_NAME}?updateMask=traffic"
  if ! node "$SCRIPT_DIR/cloudrun-state-guard.mjs" validate-api-url \
    --url="$patch_url" \
    --project="$GCP_PROJECT" \
    --region="$GCP_REGION" \
    --service="$SERVICE_NAME" \
    --kind=service-patch; then
    return 23
  fi
  local start_ms
  start_ms="$(monotonic_now_ms)"
  local deadline_ms=$(( start_ms + RPC_TIMEOUT_SECONDS * 1000 ))
  local rem_ms=$(( deadline_ms - $(monotonic_now_ms) ))
  if (( rem_ms <= 0 )); then
    return 28
  fi
  local tok_file="$WORK_DIR/.s2-patch-token.tmp"
  if ! run_bounded_step "$rem_ms" "$tok_file" gcloud auth print-access-token; then
    rm -f "$tok_file"
    return 33
  fi
  local access_token
  access_token="$(cat "$tok_file")"
  rm -f "$tok_file"

  rem_ms=$(( deadline_ms - $(monotonic_now_ms) ))
  if (( rem_ms <= 0 )); then
    return 28
  fi
  local curl_max_time
  curl_max_time="$(format_ms_as_positive_sec "$rem_ms")"
  if run_bounded_step "$rem_ms" "$out_code_file" curl -sS --max-time "$curl_max_time" -o "$out_resp_file" -w "%{http_code}" -X PATCH "$patch_url" \
    -H "Authorization: Bearer ${access_token}" \
    -H "Content-Type: application/json" \
    --data-binary "@${patch_payload_file}"; then
    :
  else
    local curl_rc=$?
    return "$curl_rc"
  fi
  if (( $(monotonic_now_ms) >= deadline_ms )); then
    return 28
  fi
  return 0
}

poll_operation_until_done() {
  local op_initial_json="$1"
  local op_prefix="$2"
  local op_env_file="$WORK_DIR/${op_prefix}-op.env"

  if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" validate-operation \
    --op-json="$op_initial_json" \
    --project="$GCP_PROJECT" \
    --region="$GCP_REGION" \
    --env-out="$op_env_file"; then
    :
  else
    local v_rc=$?
    return "$v_rc"
  fi

  # shellcheck disable=SC1090
  source "$op_env_file"
  if ! journal_event "S2_OP_REGISTERED_${op_prefix}" "POLLING" "Tracking Cloud Run v2 Operation $OP_NAME (done=$OP_DONE, timeout=${OP_TIMEOUT_SECONDS}s)"; then
    abort_on_journal_failure "$?" "S2_OP_REGISTERED_${op_prefix}"
  fi

  if [[ "$OP_DONE" == "true" ]]; then
    return 0
  fi

  local op_url="${CLOUDRUN_API_ORIGIN}/v2/${OP_NAME}"
  if ! node "$SCRIPT_DIR/cloudrun-state-guard.mjs" validate-api-url \
    --url="$op_url" \
    --project="$GCP_PROJECT" \
    --region="$GCP_REGION" \
    --service="$SERVICE_NAME" \
    --kind=operation; then
    return 23
  fi

  # PUBLIC-V4-F01: Single shared monotonic deadline covering sleep, token acquisition, curl GET, and post-response check
  local op_start_ms
  op_start_ms="$(monotonic_now_ms)"
  local op_deadline_ms=$(( op_start_ms + OP_TIMEOUT_SECONDS * 1000 ))
  local poll_idx=0

  while true; do
    local rem_ms=$(( op_deadline_ms - $(monotonic_now_ms) ))
    if (( rem_ms <= 0 )); then
      echo "[stage2] [OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT] Operation $OP_NAME deadline (${OP_TIMEOUT_SECONDS}s) reached before poll" >&2
      return 37
    fi

    if (( poll_idx > 0 && OP_POLL_INTERVAL_MS > 0 )); then
      if (( rem_ms <= OP_POLL_INTERVAL_MS )); then
        echo "[stage2] [OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT] Remaining budget (${rem_ms}ms) <= poll interval (${OP_POLL_INTERVAL_MS}ms); halting before deadline" >&2
        return 37
      fi
      local sleep_sec
      sleep_sec="$(format_ms_as_positive_sec "$OP_POLL_INTERVAL_MS")"
      sleep "$sleep_sec" 2>/dev/null || :
      rem_ms=$(( op_deadline_ms - $(monotonic_now_ms) ))
      if (( rem_ms <= 0 )); then
        echo "[stage2] [OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT] Operation $OP_NAME deadline expired during poll sleep" >&2
        return 37
      fi
    fi

    local tok_file="$WORK_DIR/${op_prefix}-tok-${poll_idx}.tmp"
    if run_bounded_step "$rem_ms" "$tok_file" gcloud auth print-access-token; then
      :
    else
      local tok_rc=$?
      rm -f "$tok_file"
      echo "[stage2] [OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT] Bounded token acquisition failed/timed out (rc=$tok_rc)" >&2
      return 37
    fi
    local access_token
    access_token="$(cat "$tok_file")"
    rm -f "$tok_file"

    rem_ms=$(( op_deadline_ms - $(monotonic_now_ms) ))
    if (( rem_ms <= 0 )); then
      echo "[stage2] [OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT] Operation $OP_NAME deadline expired after token acquisition" >&2
      return 37
    fi

    poll_idx=$(( poll_idx + 1 ))
    local poll_file="$WORK_DIR/${op_prefix}-poll-${poll_idx}.json"
    local code_file="$WORK_DIR/${op_prefix}-code-${poll_idx}.tmp"
    local curl_max_time
    curl_max_time="$(format_ms_as_positive_sec "$rem_ms")"

    if run_bounded_step "$rem_ms" "$code_file" curl -sS --max-time "$curl_max_time" -o "$poll_file" -w "%{http_code}" -X GET "$op_url" \
      -H "Authorization: Bearer ${access_token}"; then
      :
    else
      local curl_rc=$?
      rm -f "$code_file"
      echo "[stage2] [OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT] Bounded GET $op_url failed/timed out (rc=$curl_rc)" >&2
      return 37
    fi
    local http_code
    http_code="$(cat "$code_file")"
    rm -f "$code_file"

    # PUBLIC-V4-F01: Post-response monotonic deadline re-check BEFORE accepting done:true
    rem_ms=$(( op_deadline_ms - $(monotonic_now_ms) ))
    if (( rem_ms <= 0 )); then
      echo "[stage2] [OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT] Operation $OP_NAME response arrived after ${OP_TIMEOUT_SECONDS}s deadline; rejecting" >&2
      return 37
    fi

    if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
      echo "[stage2] [OPERATION_POLL_FAILED] GET $op_url returned HTTP $http_code" >&2
      return 37
    fi

    if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" validate-operation \
      --op-json="$poll_file" \
      --project="$GCP_PROJECT" \
      --region="$GCP_REGION" \
      --env-out="$op_env_file"; then
      :
    else
      local p_rc=$?
      return "$p_rc"
    fi

    # shellcheck disable=SC1090
    source "$op_env_file"
    if [[ "$OP_DONE" == "true" ]]; then
      rem_ms=$(( op_deadline_ms - $(monotonic_now_ms) ))
      if (( rem_ms <= 0 )); then
        echo "[stage2] [OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT] Operation $OP_NAME deadline expired before completion could be accepted" >&2
        return 37
      fi
      if ! journal_event "S2_OP_COMPLETED_${op_prefix}" "OK" "Operation $OP_NAME completed within deadline (polls=$poll_idx)"; then
        abort_on_journal_failure "$?" "S2_OP_COMPLETED_${op_prefix}"
      fi
      return 0
    fi
  done
}

if ! journal_event "S2_INIT" "STARTED" "Stage 2 verified candidate promotion initialized (maxAgeSeconds=$MAX_AGE_SECONDS, opTimeoutSeconds=$OP_TIMEOUT_SECONDS, rpcTimeoutSeconds=$RPC_TIMEOUT_SECONDS)"; then
  abort_on_journal_failure "$?" "S2_INIT"
fi

if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" read-receipt-env \
  --receipt-json="$RECEIPT_FILE" \
  --env-out="$WORK_DIR/stage2-receipt.env"; then
  :
else
  rc=$?
  journal_event "S2_READ_RECEIPT" "FAILED" "Stage 1 receipt integrity check failed" "INVALID_STAGE1_RECEIPT" "$rc" || :
  exit "$rc"
fi

# shellcheck disable=SC1091
source "$WORK_DIR/stage2-receipt.env"

# Phase 1: Live v1 + authoritative v2 Service GET + freshness / uid / generation / tag / digest / SA / etag gate
if gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format=json > "$WORK_DIR/stage2-pre-service.json"; then
  :
else
  rc=$?
  journal_event "S2_PRE_DESCRIBE" "FAILED" "Pre-cutover v1 service describe failed with zero mutations" "PRE_CUTOVER_DESCRIBE_FAILED" "$rc" || :
  exit "$rc"
fi

if fetch_v2_service_json "$WORK_DIR/stage2-pre-v2-service.json"; then
  :
else
  rc=$?
  journal_event "S2_PRE_V2_DESCRIBE" "FAILED" "Pre-cutover v2 Service GET failed with zero mutations" "PRE_CUTOVER_V2_DESCRIBE_FAILED" "$rc" || :
  exit "$rc"
fi

if gcloud run revisions describe "$CAND_REVISION" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format=json > "$WORK_DIR/stage2-pre-cand-revision.json"; then
  :
else
  rc=$?
  journal_event "S2_PRE_REVISION_DESCRIBE" "FAILED" "Pre-cutover candidate revision describe failed with zero mutations" "PRE_CUTOVER_REVISION_DESCRIBE_FAILED" "$rc" || :
  exit "$rc"
fi

if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" pre-stage2-gate \
  --receipt-json="$RECEIPT_FILE" \
  --service-json="$WORK_DIR/stage2-pre-service.json" \
  --v2-service-json="$WORK_DIR/stage2-pre-v2-service.json" \
  --revision-json="$WORK_DIR/stage2-pre-cand-revision.json" \
  --max-age-seconds="$MAX_AGE_SECONDS" \
  --gate-out="$WORK_DIR/stage2-pre-gate-report.json" \
  --promote-patch-out="$WORK_DIR/stage2-promote-patch.json" \
  --env-out="$WORK_DIR/stage2-gate.env"; then
  :
else
  rc=$?
  journal_event "S2_PRE_CUTOVER_GATE" "FAILED" "Pre-cutover state gate rejected promotion with zero mutations" "PRE_CUTOVER_GATE_REJECTED" "$rc" || :
  exit "$rc"
fi

# shellcheck disable=SC1091
source "$WORK_DIR/stage2-gate.env"

# Re-verify pinned candidate URL immediately prior to cutover
if node "$SCRIPT_DIR/verify-cloudrun-candidate.mjs" \
  --base-url="$PINNED_CAND_URL" \
  --expected-version="$EXPECTED_SERVER_VERSION" \
  --expected-ui-sha256="$EXPECTED_UI_HTML_SHA256" \
  --expected-challenge-token="$EXPECTED_CHALLENGE_TOKEN" \
  --out-json="$WORK_DIR/stage2-pre-cutover-verify.json"; then
  :
else
  rc=$?
  journal_event "S2_PRE_CUTOVER_RUNTIME_REVERIFY" "FAILED" "Pre-cutover runtime re-verification failed on $PINNED_CAND_URL with zero mutations" "PRE_CUTOVER_RUNTIME_VERIFY_FAILED" "$rc" || :
  exit "$rc"
fi

if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" check-freshness-before-patch \
  --receipt-json="$RECEIPT_FILE" \
  --max-age-seconds="$MAX_AGE_SECONDS"; then
  :
else
  rc=$?
  journal_event "S2_PRE_PATCH_FRESHNESS" "FAILED" "Receipt expired before atomic cutover PATCH" "STALE_STAGE1_VERIFICATION_RECEIPT" "$rc" || :
  exit "$rc"
fi

if ! journal_event "S2_PRE_CUTOVER_GATE" "OK" "Pre-cutover v1+v2 gate and runtime re-verification passed for $PINNED_CAND_REVISION (etag=$PRE_CUTOVER_ETAG)"; then
  abort_on_journal_failure "$?" "S2_PRE_CUTOVER_GATE"
fi

# Phase 2: Atomic conditional Cloud Run v2 services.patch (etag-preconditioned) + Operation polling
TRAFFIC_MUTATIONS=1
if ! journal_event "S2_CUTOVER_TRAFFIC_100" "INITIATED" "Executing atomic etag-preconditioned PATCH to $PROMOTE_TO_REVISIONS_ARG (etag=$PRE_CUTOVER_ETAG)"; then
  abort_on_journal_failure "$?" "S2_CUTOVER_TRAFFIC_100_STARTING"
fi

MUTATING_RPC_SENT=1
if atomic_patch_service_traffic \
  "$WORK_DIR/stage2-promote-patch.json" \
  "$WORK_DIR/stage2-cutover-rpc.json" \
  "$WORK_DIR/stage2-cutover-http-code.txt"; then
  :
else
  rc=$?
  OBS_FILE="$WORK_DIR/stage2-cutover-unknown-service.json"
  if gcloud run services describe "$SERVICE_NAME" \
    --project="$GCP_PROJECT" \
    --region="$GCP_REGION" \
    --format=json > "$OBS_FILE"; then
    journal_event "S2_CUTOVER_TRAFFIC_100" "HALTED" "Cutover PATCH transport returned non-zero ($rc); queried live state and halted without retry or blind rollback" "OUTCOME_UNKNOWN_HALTED" "$rc" "$OBS_FILE" || :
  else
    desc_rc=$?
    journal_event "S2_CUTOVER_TRAFFIC_100" "HALTED" "Cutover PATCH transport returned non-zero ($rc) and describe returned $desc_rc; halted without retry or blind rollback" "OUTCOME_UNKNOWN_HALTED" "$rc" || :
  fi
  exit "$rc"
fi

CUTOVER_HTTP_CODE="$(cat "$WORK_DIR/stage2-cutover-http-code.txt")"
if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" check-patch-response \
  --http-code="$CUTOVER_HTTP_CODE" \
  --response-json="$WORK_DIR/stage2-cutover-rpc.json"; then
  :
else
  patch_rc=$?
  if [[ "$patch_rc" -eq 49 ]]; then
    journal_event "S2_CUTOVER_TRAFFIC_100" "ABORTED" "Atomic PATCH rejected by server etag precondition (HTTP $CUTOVER_HTTP_CODE); third-party state untouched" "CONCURRENT_MODIFICATION_ABORTED" "$patch_rc" || :
  else
    journal_event "S2_CUTOVER_TRAFFIC_100" "FAILED" "Atomic PATCH returned HTTP $CUTOVER_HTTP_CODE" "CUTOVER_PATCH_API_FAILED" "$patch_rc" || :
  fi
  exit "$patch_rc"
fi

# PUBLIC-V3-F02 + PUBLIC-V4-F01: Monotonic-deadline-bounded poll of Cloud Run v2 Operation
if poll_operation_until_done "$WORK_DIR/stage2-cutover-rpc.json" "promote"; then
  :
else
  op_rc=$?
  if [[ "$op_rc" -eq 36 ]]; then
    journal_event "S2_CUTOVER_OPERATION" "FAILED" "Cutover Operation failed asynchronously; 0 retries and 0 blind rollbacks" "OPERATION_FAILED" "$op_rc" || :
  else
    journal_event "S2_CUTOVER_OPERATION" "HALTED" "Cutover Operation timed out or poll failed ($op_rc); 0 retries and 0 blind rollbacks" "OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT" "$op_rc" || :
  fi
  exit "$op_rc"
fi

# Phase 3: Confirm post-cutover v1 + v2 trafficStatuses converged on pinned candidate revision
if gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format=json > "$WORK_DIR/stage2-post-cutover-service.json"; then
  :
else
  rc=$?
  journal_event "S2_POST_CUTOVER_STATE_CHECK" "HALTED" "Post-cutover v1 service describe failed ($rc); halting without blind rollback" "POST_CUTOVER_DESCRIBE_FAILED_HALTED" "$rc" || :
  exit "$rc"
fi

if fetch_v2_service_json "$WORK_DIR/stage2-post-cutover-v2-service.json"; then
  :
else
  rc=$?
  journal_event "S2_POST_CUTOVER_STATE_CHECK" "HALTED" "Post-cutover v2 Service GET failed ($rc); halting without blind rollback" "POST_CUTOVER_V2_DESCRIBE_FAILED_HALTED" "$rc" || :
  exit "$rc"
fi

if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" post-cutover-v2-convergence \
  --receipt-json="$RECEIPT_FILE" \
  --service-json="$WORK_DIR/stage2-post-cutover-service.json" \
  --v2-service-json="$WORK_DIR/stage2-post-cutover-v2-service.json" \
  --expected-revision="$PINNED_CAND_REVISION" \
  --min-generation="$PRE_CUTOVER_GENERATION" \
  --env-out="$WORK_DIR/stage2-cutover-confirmed.env"; then
  :
else
  rc=$?
  journal_event "S2_POST_CUTOVER_STATE_CHECK" "HALTED" "Post-cutover v2 trafficStatuses did not converge on $PINNED_CAND_REVISION=100; halting without blind rollback" "POST_CUTOVER_NOT_OWNED_BY_CANDIDATE_HALTED" "$rc" "$WORK_DIR/stage2-post-cutover-service.json" || :
  exit "$rc"
fi

# shellcheck disable=SC1091
source "$WORK_DIR/stage2-cutover-confirmed.env"
if ! journal_event "S2_POST_CUTOVER_STATE_CHECK" "OK" "Confirmed v2 trafficStatuses $PINNED_CAND_REVISION=100 at generation=$CONFIRMED_CUTOVER_GENERATION"; then
  abort_on_journal_failure "$?" "S2_POST_CUTOVER_STATE_CHECK"
fi

# Phase 4: Full zero-KKJ-traffic runtime verification on both candidate URL and production domain
POST_VERIFY_OK=1
POST_VERIFY_FAIL_REASON=""

if node "$SCRIPT_DIR/verify-cloudrun-candidate.mjs" \
  --base-url="$PINNED_CAND_URL" \
  --expected-version="$EXPECTED_SERVER_VERSION" \
  --expected-ui-sha256="$EXPECTED_UI_HTML_SHA256" \
  --expected-challenge-token="$EXPECTED_CHALLENGE_TOKEN" \
  --out-json="$WORK_DIR/stage2-post-cand-verify.json"; then
  :
else
  POST_VERIFY_OK=0
  POST_VERIFY_FAIL_REASON="Post-cutover verification failed on candidate URL ($PINNED_CAND_URL)"
fi

if [[ "$POST_VERIFY_OK" -eq 1 ]]; then
  if node "$SCRIPT_DIR/verify-cloudrun-candidate.mjs" \
    --base-url="$PRODUCTION_DOMAIN_URL" \
    --expected-version="$EXPECTED_SERVER_VERSION" \
    --expected-ui-sha256="$EXPECTED_UI_HTML_SHA256" \
    --expected-challenge-token="$EXPECTED_CHALLENGE_TOKEN" \
    --out-json="$WORK_DIR/stage2-post-prod-verify.json"; then
    :
  else
    POST_VERIFY_OK=0
    POST_VERIFY_FAIL_REASON="Post-cutover verification failed on production domain ($PRODUCTION_DOMAIN_URL)"
  fi
fi

if [[ "$POST_VERIFY_OK" -eq 1 ]]; then
  if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" write-promotion-complete \
    --receipt-json="$RECEIPT_FILE" \
    --cand-verify-json="$WORK_DIR/stage2-post-cand-verify.json" \
    --prod-verify-json="$WORK_DIR/stage2-post-prod-verify.json" \
    --confirmed-cutover-generation="$CONFIRMED_CUTOVER_GENERATION" \
    --out-json="$WORK_DIR/stage2-promotion-complete.json"; then
    if ! journal_event "S2_COMPLETE" "OK" "Candidate promoted to 100% and verified on both candidate URL and production domain" "PROMOTED_AND_VERIFIED" "0"; then
      abort_on_journal_failure "$?" "S2_COMPLETE"
    fi
    exit 0
  else
    rc=$?
    rm -f "$WORK_DIR/stage2-promotion-complete.json"
    journal_event "S2_WRITE_COMPLETE" "FAILED" "Failed to write stage2-promotion-complete.json" "WRITE_COMPLETE_FAILED" "$rc" || :
    exit "$rc"
  fi
fi

# Post-cutover runtime verification failed: check v1 + v2 ownership & capture v2 etag for conditional 1-shot rollback
if ! journal_event "S2_POST_CUTOVER_VERIFY_FAILED" "FAILED" "$POST_VERIFY_FAIL_REASON; checking v1+v2 ownership before conditional rollback"; then
  abort_on_journal_failure "$?" "S2_POST_CUTOVER_VERIFY_FAILED"
fi

if gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format=json > "$WORK_DIR/stage2-pre-rollback-service.json"; then
  :
else
  desc_rc=$?
  journal_event "S2_PRE_ROLLBACK_OWNERSHIP_CHECK" "HALTED" "Pre-rollback v1 service describe failed ($desc_rc); refusing blind rollback" "PRE_ROLLBACK_DESCRIBE_FAILED_HALTED" "$desc_rc" || :
  exit "$desc_rc"
fi

if fetch_v2_service_json "$WORK_DIR/stage2-pre-rollback-v2-service.json"; then
  :
else
  desc_rc=$?
  journal_event "S2_PRE_ROLLBACK_OWNERSHIP_CHECK" "HALTED" "Pre-rollback v2 Service GET failed ($desc_rc); refusing blind rollback" "PRE_ROLLBACK_V2_DESCRIBE_FAILED_HALTED" "$desc_rc" || :
  exit "$desc_rc"
fi

if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" pre-rollback-ownership-check \
  --receipt-json="$RECEIPT_FILE" \
  --service-json="$WORK_DIR/stage2-pre-rollback-service.json" \
  --v2-service-json="$WORK_DIR/stage2-pre-rollback-v2-service.json" \
  --confirmed-cutover-generation="$CONFIRMED_CUTOVER_GENERATION" \
  --rollback-patch-out="$WORK_DIR/stage2-rollback-patch.json" \
  --out-json="$WORK_DIR/stage2-rollback-ownership.json"; then
  :
else
  own_rc=$?
  journal_event "S2_PRE_ROLLBACK_OWNERSHIP_CHECK" "HALTED" "Third-party or concurrent state change detected; refusing rollback" "THIRD_PARTY_CHANGED_HALTED_NO_ROLLBACK" "$own_rc" "$WORK_DIR/stage2-pre-rollback-service.json" || :
  exit "$own_rc"
fi

# Ownership confirmed: execute at most 1 conditional etag-preconditioned rollback PATCH + Operation polling
ROLLBACK_ATTEMPTS=1
TRAFFIC_MUTATIONS=2
if ! journal_event "S2_ROLLBACK_ONCE" "INITIATED" "Executing single conditional rollback PATCH to $ROLLBACK_TO_REVISIONS_ARG"; then
  abort_on_journal_failure "$?" "S2_ROLLBACK_ONCE_STARTING"
fi

if atomic_patch_service_traffic \
  "$WORK_DIR/stage2-rollback-patch.json" \
  "$WORK_DIR/stage2-rollback-rpc.json" \
  "$WORK_DIR/stage2-rollback-http-code.txt"; then
  :
else
  rb_rc=$?
  RB_OBS_FILE="$WORK_DIR/stage2-rollback-failed-service.json"
  if gcloud run services describe "$SERVICE_NAME" \
    --project="$GCP_PROJECT" \
    --region="$GCP_REGION" \
    --format=json > "$RB_OBS_FILE"; then
    journal_event "S2_ROLLBACK_ONCE" "FAILED" "Rollback PATCH transport failed ($rb_rc); error not masked" "ROLLBACK_RPC_FAILED" "$rb_rc" "$RB_OBS_FILE" || :
  else
    journal_event "S2_ROLLBACK_ONCE" "FAILED" "Rollback PATCH transport failed ($rb_rc) and follow-up describe failed; error not masked" "ROLLBACK_RPC_FAILED" "$rb_rc" || :
  fi
  exit "$rb_rc"
fi

RB_HTTP_CODE="$(cat "$WORK_DIR/stage2-rollback-http-code.txt")"
if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" check-patch-response \
  --http-code="$RB_HTTP_CODE" \
  --response-json="$WORK_DIR/stage2-rollback-rpc.json"; then
  :
else
  rb_patch_rc=$?
  if [[ "$rb_patch_rc" -eq 49 ]]; then
    journal_event "S2_ROLLBACK_ONCE" "ABORTED" "Rollback conditional PATCH rejected by server etag precondition (HTTP $RB_HTTP_CODE); third-party state untouched" "CONCURRENT_MODIFICATION_ABORTED" "$rb_patch_rc" || :
  else
    journal_event "S2_ROLLBACK_ONCE" "FAILED" "Rollback conditional PATCH returned HTTP $RB_HTTP_CODE" "ROLLBACK_RPC_FAILED" "$rb_patch_rc" || :
  fi
  exit "$rb_patch_rc"
fi

# Poll rollback Operation within monotonic deadline
if poll_operation_until_done "$WORK_DIR/stage2-rollback-rpc.json" "rollback"; then
  :
else
  rb_op_rc=$?
  if [[ "$rb_op_rc" -eq 36 ]]; then
    journal_event "S2_ROLLBACK_OPERATION" "FAILED" "Rollback Operation failed asynchronously" "ROLLBACK_OPERATION_FAILED" "$rb_op_rc" || :
  else
    journal_event "S2_ROLLBACK_OPERATION" "HALTED" "Rollback Operation timed out or poll failed ($rb_op_rc)" "OPERATION_OUTCOME_UNKNOWN_OR_TIMEOUT" "$rb_op_rc" || :
  fi
  exit "$rb_op_rc"
fi

# Verify post-rollback restoration of previous 100% revision and all preserved tags in both v1 and v2 trafficStatuses
if gcloud run services describe "$SERVICE_NAME" \
  --project="$GCP_PROJECT" \
  --region="$GCP_REGION" \
  --format=json > "$WORK_DIR/stage2-post-rollback-service.json"; then
  :
else
  rb_desc_rc=$?
  journal_event "S2_POST_ROLLBACK_VERIFY" "FAILED" "Post-rollback v1 service describe failed ($rb_desc_rc)" "POST_ROLLBACK_DESCRIBE_FAILED" "$rb_desc_rc" || :
  exit "$rb_desc_rc"
fi

if fetch_v2_service_json "$WORK_DIR/stage2-post-rollback-v2-service.json"; then
  :
else
  rb_desc_rc=$?
  journal_event "S2_POST_ROLLBACK_VERIFY" "FAILED" "Post-rollback v2 Service GET failed ($rb_desc_rc)" "POST_ROLLBACK_V2_DESCRIBE_FAILED" "$rb_desc_rc" || :
  exit "$rb_desc_rc"
fi

if node "$SCRIPT_DIR/cloudrun-state-guard.mjs" post-rollback-verify \
  --receipt-json="$RECEIPT_FILE" \
  --service-json="$WORK_DIR/stage2-post-rollback-service.json" \
  --v2-service-json="$WORK_DIR/stage2-post-rollback-v2-service.json" \
  --out-json="$WORK_DIR/stage2-post-rollback-verify.json"; then
  if ! journal_event "S2_ROLLED_BACK" "ROLLED_BACK" "Restored $PINNED_PREV_100_REVISION=100 and all tags in v1+v2 trafficStatuses after post-cutover verification failure" "ROLLED_BACK_AFTER_POST_CUTOVER_VERIFY_FAILURE" "29" "$WORK_DIR/stage2-post-rollback-service.json"; then
    abort_on_journal_failure "$?" "S2_ROLLED_BACK"
  fi
  exit 29
else
  rb_ver_rc=$?
  journal_event "S2_POST_ROLLBACK_VERIFY" "FAILED" "Post-rollback state verification failed ($rb_ver_rc)" "POST_ROLLBACK_STATE_MISMATCH" "$rb_ver_rc" "$WORK_DIR/stage2-post-rollback-service.json" || :
  exit "$rb_ver_rc"
fi
