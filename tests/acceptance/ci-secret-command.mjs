import assert from "node:assert/strict";

const stepName = "Verify no secret-bearing artifacts in generated evidence";
const required = [
  "--require=gate1/gate1-summary.json",
  "--require=f01-child-cleanup-probes-after.json",
  "--require=cloudshell-offline-sim-results.json",
];

// Parse only this workflow's literal jobs/check/steps layout. Unsupported
// layouts fail instead of guessing at a command or evaluating YAML expressions.
export function extractSecretCheckCommand(text) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  assert.ok(!lines.some((line) => /^\s*\t/.test(line)), "Tabs in workflow indentation");
  function block(input, header, indent) {
    const starts = input.flatMap((line, index) => (line === header ? [index] : []));
    assert.equal(starts.length, 1, `Expected one ${header.trim()} block`);
    const start = starts[0] + 1;
    const tail = input.slice(start);
    const end = tail.findIndex(
      (line) => line.trim() && !line.trimStart().startsWith("#") && line.search(/\S/) <= indent,
    );
    return end < 0 ? tail : tail.slice(0, end);
  }
  const steps = block(block(block(lines, "jobs:", 0), "  check:", 2), "    steps:", 4);
  const starts = steps.flatMap((line, index) => (/^ {6}- /.test(line) ? [index] : []));
  const matches = [];
  for (let index = 0; index < starts.length; index++) {
    const fields = new Map();
    const duplicates = [];
    const body = steps.slice(starts[index], starts[index + 1] ?? steps.length);
    for (const [offset, line] of body.entries()) {
      const match = line.slice(8).match(/^([\w-]+):\s*(.*)$/);
      if (!match || (offset > 0 && !/^ {8}\S/.test(line))) continue;
      if (fields.has(match[1])) duplicates.push(match[1]);
      fields.set(match[1], match[2].trim());
    }
    const name = fields.get("name")?.replace(/^(["'])(.*)\1$/, "$2");
    if (name === stepName) matches.push({ fields, duplicates });
  }
  assert.equal(matches.length, 1, "Expected exactly one secret-check step in check job");
  const { fields, duplicates } = matches[0];
  assert.equal(duplicates.length, 0, "Duplicate field in secret-check step");
  assert.ok(!fields.has("uses"), "Secret-check step must run the scanner directly");
  assert.ok(!fields.has("continue-on-error"), "Secret-check failures must not be ignored");
  assert.ok(!fields.has("working-directory"), "Secret-check must use the repository root");
  assert.ok(
    !fields.has("if") || fields.get("if") === "always()",
    "Unexpected secret-check condition",
  );
  const command = fields.get("run");
  assert.ok(command, "Missing secret-check run command");
  const parts = command.split(/\s+/);
  assert.deepEqual(parts.slice(0, 3), ["node", "scripts/ci-verify-no-secrets.mjs", "evidence"]);
  assert.deepEqual(parts.slice(3).sort(), [...required].sort(), "Unexpected scanner arguments");
  return command;
}
