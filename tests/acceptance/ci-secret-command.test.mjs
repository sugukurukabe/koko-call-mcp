import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { extractSecretCheckCommand } from "./ci-secret-command.mjs";

const name = "Verify no secret-bearing artifacts in generated evidence";
const command =
  "node scripts/ci-verify-no-secrets.mjs evidence --require=gate1/gate1-summary.json --require=f01-child-cleanup-probes-after.json --require=cloudshell-offline-sim-results.json";
const workflow = (body) =>
  `name: Test\njobs:\n  check:\n    steps:\n${body}\n  gateway-check:\n    steps:\n      - run: echo other\n`;
const step = `      - name: ${name}\n        run: ${command}`;

test("extracts the actual final workflow with id and if metadata", () => {
  const actual = fs.readFileSync(
    new URL("../../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  assert.equal(extractSecretCheckCommand(actual), command);
});
test("accepts the step without optional metadata", () => {
  assert.equal(extractSecretCheckCommand(workflow(step)), command);
});
test("accepts metadata before the name and reordered fields", () => {
  assert.equal(
    extractSecretCheckCommand(
      workflow(
        `      - id: safe-evidence\n        if: always()\n        run: ${command}\n        name: '${name}'`,
      ),
    ),
    command,
  );
});
test("supports CRLF and ignores nested names and other job decoys", () => {
  const value = workflow(
    `      - name: Other\n        env:\n          name: ${name}\n          run: echo decoy\n${step}`,
  ).replace("      - run: echo other", step);
  assert.equal(extractSecretCheckCommand(value.replaceAll("\n", "\r\n")), command);
});
for (const [label, body] of [
  ["missing step", "      - run: echo unrelated"],
  ["duplicate step", `${step}\n${step}`],
  ["duplicate run", `${step}\n        run: ${command}`],
  ["missing required evidence", step.replace(" --require=cloudshell-offline-sim-results.json", "")],
  ["extra shell command", `${step} && echo bypass`],
  ["wrong scanner", step.replace("scripts/ci-verify-no-secrets.mjs", "scripts/other.mjs")],
  ["ignored errors", `${step}\n        continue-on-error: true`],
  ["conditional bypass", `${step}\n        if: false`],
  ["multiline command", `      - name: ${name}\n        run: |\n          ${command}`],
]) {
  test(`rejects ${label}`, () => assert.throws(() => extractSecretCheckCommand(workflow(body))));
}
