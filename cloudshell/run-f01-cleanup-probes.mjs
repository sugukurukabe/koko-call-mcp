import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const V6_ROOT = path.resolve(import.meta.dirname, "..");
const CLOUDSHELL_DIR = path.join(V6_ROOT, "cloudshell");
const EVIDENCE_DIR = path.join(V6_ROOT, "evidence");
const OUT_FILE = path.join(EVIDENCE_DIR, "f01-child-cleanup-probes-after.json");
const BASH_EXE = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";

function extractHelperBlock(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const startMarker = "STEP_OWNERSHIP_SEQ=0";
  const endMarker = "\nassert_proc_capability\n";
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker, startIdx);
  if (startIdx < 0 || endIdx < 0) {
    throw new Error(`Failed to locate helper block in ${filePath}`);
  }
  return text.slice(startIdx, endIdx);
}

const stage1Path = path.join(CLOUDSHELL_DIR, "stage1-deploy-0pct-candidate.sh");
const stage2Path = path.join(CLOUDSHELL_DIR, "stage2-promote-verified-candidate.sh");
const stage1Block = extractHelperBlock(stage1Path);
const stage2Block = extractHelperBlock(stage2Path);
const stage1Sha256 = crypto.createHash("sha256").update(stage1Block).digest("hex");
const stage2Sha256 = crypto.createHash("sha256").update(stage2Block).digest("hex");

if (stage1Sha256 !== stage2Sha256) {
  throw new Error(`Helper block parity mismatch: stage1=${stage1Sha256} stage2=${stage2Sha256}`);
}

const tmpDir = fs.mkdtempSync(path.join(V6_ROOT, "f01-probes-tmp-"));
const toPosix = (p) =>
  p.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`);

try {
  const helperFile = path.join(tmpDir, "helper.sh");
  fs.writeFileSync(
    helperFile,
    [
      "#!/usr/bin/env bash",
      "set -u -o pipefail",
      'SCRIPT_NAME="f01-probe"',
      'readonly CHILD_TERM_GRACE_SEC="0.250"',
      `WORK_DIR="${toPosix(tmpDir)}/work"`,
      'mkdir -p "$WORK_DIR"',
      stage1Block,
      "",
    ].join("\n"),
    "utf8",
  );

  // Write probe fixtures
  const normalCmd = path.join(tmpDir, "normal.sh");
  fs.writeFileSync(
    normalCmd,
    '#!/usr/bin/env bash\nsleep 0.08\necho "NORMAL_OK"\nexit 0\n',
    "utf8",
  );

  const earlyCmd = path.join(tmpDir, "early7.sh");
  fs.writeFileSync(earlyCmd, '#!/usr/bin/env bash\necho "EARLY_7"\nexit 7\n', "utf8");

  const leafCmd = path.join(tmpDir, "leaf.sh");
  fs.writeFileSync(
    leafCmd,
    `#!/usr/bin/env bash
trap '' TERM INT
echo $$ > "$1"
sleep 2.5
echo SURVIVED > "$2"
`,
    "utf8",
  );

  const parentDiesCmd = path.join(tmpDir, "parent-dies.sh");
  fs.writeFileSync(
    parentDiesCmd,
    `#!/usr/bin/env bash
bash "${toPosix(leafCmd)}" "$1" "$2" &
wait
`,
    "utf8",
  );

  const middleCmd = path.join(tmpDir, "middle.sh");
  fs.writeFileSync(
    middleCmd,
    `#!/usr/bin/env bash
trap '' TERM INT
echo $$ > "$1"
bash "${toPosix(leafCmd)}" "$2" "$3" &
wait
`,
    "utf8",
  );

  const deepParentCmd = path.join(tmpDir, "deep-parent.sh");
  fs.writeFileSync(
    deepParentCmd,
    `#!/usr/bin/env bash
bash "${toPosix(middleCmd)}" "$1" "$2" "$3" &
wait
`,
    "utf8",
  );

  const probeScript = path.join(tmpDir, "run-probes.sh");
  const tmpPosix = toPosix(tmpDir);
  fs.writeFileSync(
    probeScript,
    `#!/usr/bin/env bash
set -u -o pipefail
source "${toPosix(helperFile)}"
assert_proc_capability

run_case1() {
  local out="${tmpPosix}/c1.out"
  local t0 t1 rc
  t0="$(monotonic_now_ms)"
  run_bounded_step 1500 "$out" bash "${toPosix(normalCmd)}"
  rc=$?
  t1="$(monotonic_now_ms)"
  sleep 0.1
  local stray=0
  local e=""
  for e in /proc/[0-9]*; do
    local p="\${e#/proc/}"
    if [[ -r "/proc/$p/environ" ]] && tr '\\0' '\\n' < "/proc/$p/environ" 2>/dev/null | grep -Fq "JP_BIDS_OWNED_STEP_TOKEN=jpbids-$$-"; then
      stray=$(( stray + 1 ))
    fi
  done
  printf '{"case":"normal_completion_and_watchdog_reap","rc":%d,"elapsed_ms":%d,"stray_owned":%d}\n' "$rc" "$(( t1 - t0 ))" "$stray"
}

run_case2() {
  local out="${tmpPosix}/c2.out"
  local pidf="${tmpPosix}/c2.leaf.pid"
  local mark="${tmpPosix}/c2.leaf.survived"
  rm -f "$pidf" "$mark"
  local t0 t1 rc
  t0="$(monotonic_now_ms)"
  if run_bounded_step 500 "$out" bash "${toPosix(parentDiesCmd)}" "$pidf" "$mark"; then
    rc=0
  else
    rc=$?
  fi
  t1="$(monotonic_now_ms)"
  local lpid=""
  [[ -r "$pidf" ]] && lpid="$(cat "$pidf" 2>/dev/null || :)"
  local alive_after=0
  if [[ -n "$lpid" ]] && kill -0 "$lpid" 2>/dev/null; then
    alive_after=1
  fi
  sleep 2.6
  local smark=0
  [[ -f "$mark" ]] && smark=1
  printf '{"case":"parent_dies_on_term_child_ignores_term","helper_rc":%d,"elapsed_ms":%d,"leaf_pid":"%s","leaf_alive_after_grace":%d,"survival_marker":%d}\n' "$rc" "$(( t1 - t0 ))" "$lpid" "$alive_after" "$smark"
}

run_case3() {
  local out="${tmpPosix}/c3.out"
  local mpidf="${tmpPosix}/c3.mid.pid"
  local lpidf="${tmpPosix}/c3.leaf.pid"
  local mark="${tmpPosix}/c3.leaf.survived"
  rm -f "$mpidf" "$lpidf" "$mark"
  local t0 t1 rc
  t0="$(monotonic_now_ms)"
  if run_bounded_step 500 "$out" bash "${toPosix(deepParentCmd)}" "$mpidf" "$lpidf" "$mark"; then
    rc=0
  else
    rc=$?
  fi
  t1="$(monotonic_now_ms)"
  local mpid="" lpid=""
  [[ -r "$mpidf" ]] && mpid="$(cat "$mpidf" 2>/dev/null || :)"
  [[ -r "$lpidf" ]] && lpid="$(cat "$lpidf" 2>/dev/null || :)"
  local malive=0 lalive=0
  if [[ -n "$mpid" ]] && kill -0 "$mpid" 2>/dev/null; then malive=1; fi
  if [[ -n "$lpid" ]] && kill -0 "$lpid" 2>/dev/null; then lalive=1; fi
  sleep 2.6
  local smark=0
  [[ -f "$mark" ]] && smark=1
  printf '{"case":"deep_descendant_tree_cleanup","helper_rc":%d,"elapsed_ms":%d,"middle_pid":"%s","leaf_pid":"%s","middle_alive_after_grace":%d,"leaf_alive_after_grace":%d,"survival_marker":%d}\n' "$rc" "$(( t1 - t0 ))" "$mpid" "$lpid" "$malive" "$lalive" "$smark"
}

run_case4() {
  local out="${tmpPosix}/c4.out"
  local t0 t1 rc
  t0="$(monotonic_now_ms)"
  if run_bounded_step 1500 "$out" bash "${toPosix(earlyCmd)}"; then
    rc=0
  else
    rc=$?
  fi
  t1="$(monotonic_now_ms)"
  printf '{"case":"early_finish_preserves_exit_code","rc":%d,"elapsed_ms":%d}\n' "$rc" "$(( t1 - t0 ))"
}

run_case5() {
  local out="${tmpPosix}/c5.out"
  local pidf="${tmpPosix}/c5.leaf.pid"
  local mark="${tmpPosix}/c5.leaf.survived"
  rm -f "$pidf" "$mark"
  local pkill_present=0
  if command -v pkill >/dev/null 2>&1; then pkill_present=1; fi
  local proc_ok=0
  if [[ -d /proc && -r "/proc/$$/stat" && -r "/proc/$$/environ" ]]; then proc_ok=1; fi
  local rc
  if run_bounded_step 500 "$out" bash "${toPosix(parentDiesCmd)}" "$pidf" "$mark"; then
    rc=0
  else
    rc=$?
  fi
  local lpid=""
  [[ -r "$pidf" ]] && lpid="$(cat "$pidf" 2>/dev/null || :)"
  local alive_after=0
  if [[ -n "$lpid" ]] && kill -0 "$lpid" 2>/dev/null; then alive_after=1; fi
  sleep 2.6
  local smark=0
  [[ -f "$mark" ]] && smark=1
  printf '{"case":"pkill_absent_proc_capability_present","pkill_present":%d,"proc_capability_ok":%d,"helper_rc":%d,"leaf_alive_after_grace":%d,"survival_marker":%d}\n' "$pkill_present" "$proc_ok" "$rc" "$alive_after" "$smark"
}

run_case1
run_case2
run_case3
run_case4
run_case5
`,
    "utf8",
  );

  const rawOut = execFileSync(BASH_EXE, [toPosix(probeScript)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const cases = rawOut
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const assertions = {
    helperParitySha256Match: stage1Sha256 === stage2Sha256,
    case1NormalPass: cases[0]?.rc === 0 && cases[0]?.stray_owned === 0,
    case2ParentDiesLeafKilledPass:
      cases[1]?.helper_rc === 124 &&
      cases[1]?.leaf_alive_after_grace === 0 &&
      cases[1]?.survival_marker === 0,
    case3DeepTreeKilledPass:
      cases[2]?.helper_rc === 124 &&
      cases[2]?.middle_alive_after_grace === 0 &&
      cases[2]?.leaf_alive_after_grace === 0 &&
      cases[2]?.survival_marker === 0,
    case4EarlyFinishPass: cases[3]?.rc === 7 && cases[3]?.elapsed_ms < 500,
    case5ProcWithoutPkillPass:
      cases[4]?.proc_capability_ok === 1 &&
      cases[4]?.helper_rc === 124 &&
      cases[4]?.leaf_alive_after_grace === 0 &&
      cases[4]?.survival_marker === 0,
  };

  const allPassed = Object.values(assertions).every(Boolean);
  const report = {
    schemaVersion: "jp-bids-f01-cleanup-probes-v1",
    generatedAt: new Date().toISOString(),
    findingId: "PUBLIC-V5-F01",
    stage1HelperSha256: stage1Sha256,
    stage2HelperSha256: stage2Sha256,
    allPassed,
    assertions,
    cases,
  };

  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  if (!allPassed) {
    process.exitCode = 1;
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
