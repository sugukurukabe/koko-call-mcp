# Security checks for this repository

The dependency gate checks both root and gateway lockfiles, including development and optional dependencies. It fails on Critical, High, or Moderate findings and on registry, parsing, or input-integrity errors. It never applies fixes. For pull requests it also records version and license changes against the base lockfiles. Package names and versions are sent to the public npm advisory API; source code and credentials are not sent.

For public repositories, `dependency-review.yml` retains the native GitHub dependency-review action. For private repositories it runs `security:dependencies` and labels the strategy as `FULL_HEAD_AUDIT_WITH_LOCK_DIFF`. This provides a working dependency check without claiming that native Dependency Review has run. The fallback checks the full head dependency set rather than only newly introduced vulnerabilities. It does not provide GitHub's dependency-review interface or an additional license policy.

`code-security.yml` runs a separate Semgrep Community Edition source scan. It installs only a hash-pinned engine distribution, using neither the cloud service nor a login token. The direct engine interface avoids Windows RPC and temporary-socket limitations. Rules are read only from the checked-in bundle; there are no metrics or remote rule lookups during this scan.

The scan covers JavaScript and TypeScript under `src`, `ui`, `gateway/src`, and `scripts`. It fails on missing targets, engine errors, or unreviewed findings. Community Edition analysis is not identical to CodeQL or Semgrep Pro analysis, and this check does not claim equivalent inter-file dataflow coverage. Tests, generated assets, third-party code, and static scanner canaries are outside the production scan scope.

The bundle preserves 188 security rules from the commit recorded in `security/semgrep/vendor-manifest.json`. One MCP SSRF rule is corrected locally: Axios sinks are bound to an actual Axios import rather than matching arbitrary functions or `Map.get`. Static positive fixtures must detect unsafe `fetch`, Axios calls, and Axios GET requests; negative fixtures must reject ordinary map and decoder calls. The source commit, file hashes, local correction, and bundle hash are recorded. The rule license is retained in `security/semgrep/LICENSE.rules`.

Five reviewed findings are inapplicable in their fixed contexts: two loopback-only DevTools requests, synthetic XML fixture generation, an offline browser process launch with an argument array, and a local packaging-schema validator. These are not blanket exceptions. Each record binds the rule, source path, line, and full source hash, with a reason and evidence. Changed source or stale records require review. Raw findings remain in the report.

`security:verify` checks the dependency gate with six end-to-end boundary cases and verifies three positive and two negative SSRF canaries. No live registry call is made by these probes.

CI verifies generated JSON for secrets before uploading it to repository-scoped artifacts, retained for seven days. Source upload, cloud security services, and third-party reporting are not part of these checks.

The existing CodeQL workflow is preserved. Its previous `disabled_manually` state and the account's native-feature entitlement remain administrative questions. This change neither enables CodeQL nor reports CodeQL as successful. Selecting this independent private-repository strategy does not require making the repository public or changing its owner or subscription.

Useful commands:

```sh
npm run security:dependencies -- --base BASE_COMMIT_SHA
python -m pip install --no-deps --require-hashes --only-binary=:all: -r security/semgrep/requirements.txt
# Set SEMGREP_CORE_PATH to the installed semgrep/bin/semgrep-core executable.
npm run security:verify
npm run security:code
```
