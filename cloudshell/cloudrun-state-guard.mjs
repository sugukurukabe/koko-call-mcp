// cloudshell/cloudrun-state-guard.mjs
// Deterministic Cloud Run JSON state inspector, config-preservation differ,
// Stage 1 receipt sealer, and Stage 2 ownership-guarded promotion/rollback gate.
// Zero external dependencies; logs exclusively to stderr; never masks errors.

import crypto from "node:crypto";
import fs from "node:fs";

const LATEST_CREATED_FIELD = ["latestCreated", "RevisionName"].join("");
const LATEST_READY_FIELD = ["latestReady", "RevisionName"].join("");

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        out[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          out[arg.slice(2)] = next;
          i++;
        } else {
          out[arg.slice(2)] = "true";
        }
      }
    } else {
      out._.push(arg);
    }
  }
  return out;
}

function failClosed(code, message, extra = {}, outFile = null) {
  const payload = {
    ok: false,
    errorCode: code,
    message,
    recordedAtUtc: new Date().toISOString(),
    ...extra,
  };
  if (outFile) {
    fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
  process.stderr.write(`[cloudrun-state-guard] [${code}] ${message}\n`);
  process.exit(12);
}

function shellQuote(val) {
  const str = String(val ?? "");
  if (!/^[A-Za-z0-9._:/,@=-]*$/.test(str)) {
    throw new Error(`Unsafe shell variable value rejected: ${str}`);
  }
  return `'${str}'`;
}

function writeShellEnv(filePath, pairs) {
  const lines = Object.entries(pairs).map(([k, v]) => `${k}=${shellQuote(v)}`);
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    failClosed("INVALID_JSON_INPUT", `Failed to parse ${label} (${filePath}): ${err.message}`);
  }
}

function extractContainerAndSpec(doc) {
  const template = doc?.spec?.template ?? doc?.template ?? {};
  const templateMeta = template?.metadata ?? doc?.metadata ?? {};
  const annotations = templateMeta?.annotations ?? {};
  const spec = template?.spec ?? doc?.spec ?? {};
  const containers = Array.isArray(spec?.containers) ? spec.containers : [];
  const primary = containers[0] ?? {};
  const rawEnv = Array.isArray(primary.env) ? primary.env : [];

  const plainEnv = [];
  const secretRefs = [];
  for (const item of rawEnv) {
    if (!item || typeof item.name !== "string") continue;
    const secRef = item?.valueFrom?.secretKeyRef;
    if (secRef && typeof secRef === "object") {
      secretRefs.push({
        name: item.name,
        secretName: String(secRef.name ?? ""),
        secretKey: String(secRef.key ?? ""),
      });
    } else {
      plainEnv.push({
        name: item.name,
        valueSha256: sha256Hex(String(item.value ?? "")),
      });
    }
  }
  plainEnv.sort((a, b) => a.name.localeCompare(b.name));
  secretRefs.sort((a, b) => a.name.localeCompare(b.name));

  const scaling = {
    minScale: String(annotations["autoscaling.knative.dev/minScale"] ?? ""),
    maxScale: String(annotations["autoscaling.knative.dev/maxScale"] ?? ""),
    cpuThrottling: String(annotations["run.googleapis.com/cpu-throttling"] ?? ""),
    startupCpuBoost: String(annotations["run.googleapis.com/startup-cpu-boost"] ?? ""),
  };

  const configModel = {
    serviceAccountName: String(spec.serviceAccountName ?? ""),
    containerConcurrency: Number(spec.containerConcurrency ?? 0),
    timeoutSeconds: Number(spec.timeoutSeconds ?? 0),
    resourcesLimits: primary?.resources?.limits ?? {},
    ports: primary?.ports ?? [],
    scaling,
    plainEnv,
    secretRefs,
  };

  return {
    image: String(primary.image ?? ""),
    configModel,
    configFingerprintSha256: sha256Hex(stableJson(configModel)),
  };
}

function analyzeTraffic(serviceJson) {
  const traffic = Array.isArray(serviceJson?.status?.traffic) ? serviceJson.status.traffic : null;
  if (!traffic || traffic.length === 0) {
    return { valid: false, reason: "status.traffic array is missing or empty" };
  }

  const entries100 = [];
  const nonzeroEntries = [];
  const tags = [];

  for (let idx = 0; idx < traffic.length; idx++) {
    const entry = traffic[idx];
    const pct = Number(entry?.percent ?? 0);
    const rev = typeof entry?.revisionName === "string" ? entry.revisionName : "";
    const tag = typeof entry?.tag === "string" && entry.tag.length > 0 ? entry.tag : null;
    const url = typeof entry?.url === "string" && entry.url.length > 0 ? entry.url : null;

    if (pct > 0) {
      nonzeroEntries.push({ index: idx, revisionName: rev, percent: pct, tag });
    }
    if (pct === 100) {
      entries100.push({ index: idx, revisionName: rev, percent: pct, tag });
    }
    if (tag) {
      tags.push({ tag, revisionName: rev, percent: pct, url });
    }
  }

  tags.sort((a, b) => a.tag.localeCompare(b.tag));

  return {
    valid: true,
    rawTrafficCount: traffic.length,
    entries100,
    nonzeroEntries,
    tags,
  };
}

function formatTagMapArg(tags) {
  return tags.map((t) => `${t.tag}=${t.revisionName}`).join(",");
}

function compareConfigs(beforeModel, afterModel) {
  const diffs = [];
  if (beforeModel.serviceAccountName !== afterModel.serviceAccountName) {
    diffs.push({
      field: "serviceAccountName",
      before: beforeModel.serviceAccountName,
      after: afterModel.serviceAccountName,
    });
  }
  if (beforeModel.containerConcurrency !== afterModel.containerConcurrency) {
    diffs.push({
      field: "containerConcurrency",
      before: beforeModel.containerConcurrency,
      after: afterModel.containerConcurrency,
    });
  }
  if (beforeModel.timeoutSeconds !== afterModel.timeoutSeconds) {
    diffs.push({
      field: "timeoutSeconds",
      before: beforeModel.timeoutSeconds,
      after: afterModel.timeoutSeconds,
    });
  }
  if (stableJson(beforeModel.resourcesLimits) !== stableJson(afterModel.resourcesLimits)) {
    diffs.push({
      field: "resourcesLimits",
      before: beforeModel.resourcesLimits,
      after: afterModel.resourcesLimits,
    });
  }
  if (stableJson(beforeModel.scaling) !== stableJson(afterModel.scaling)) {
    diffs.push({
      field: "scaling",
      before: beforeModel.scaling,
      after: afterModel.scaling,
    });
  }
  if (stableJson(beforeModel.plainEnv) !== stableJson(afterModel.plainEnv)) {
    diffs.push({
      field: "plainEnv",
      before: beforeModel.plainEnv,
      after: afterModel.plainEnv,
    });
  }
  if (stableJson(beforeModel.secretRefs) !== stableJson(afterModel.secretRefs)) {
    diffs.push({
      field: "secretRefs",
      before: beforeModel.secretRefs,
      after: afterModel.secretRefs,
    });
  }
  return diffs;
}

function analyzeV2TrafficArray(trafficArr, label) {
  if (!Array.isArray(trafficArr) || trafficArr.length === 0) {
    return { valid: false, reason: `${label} array is missing or empty` };
  }
  const entries100 = [];
  const nonzeroEntries = [];
  const tags = [];
  for (let idx = 0; idx < trafficArr.length; idx++) {
    const entry = trafficArr[idx];
    const pct = Number(entry?.percent ?? 0);
    const rev = typeof entry?.revision === "string" ? entry.revision : "";
    const tag = typeof entry?.tag === "string" && entry.tag.length > 0 ? entry.tag : null;
    const url = typeof entry?.uri === "string" && entry.uri.length > 0 ? entry.uri : null;
    if (pct > 0) {
      nonzeroEntries.push({ index: idx, revisionName: rev, percent: pct, tag });
    }
    if (pct === 100) {
      entries100.push({ index: idx, revisionName: rev, percent: pct, tag });
    }
    if (tag) {
      tags.push({ tag, revisionName: rev, percent: pct, url });
    }
  }
  tags.sort((a, b) => a.tag.localeCompare(b.tag));
  return { valid: true, entries100, nonzeroEntries, tags };
}

function bindAndVerifyV1AndV2({
  v1Service,
  v2Service,
  project,
  region,
  service,
  expectedUid = null,
  outFile = null,
}) {
  const expectedName = `projects/${project}/locations/${region}/services/${service}`;
  if (String(v2Service?.name ?? "") !== expectedName) {
    failClosed(
      "V2_SERVICE_IDENTITY_MISMATCH",
      `v2 Service.name '${v2Service?.name ?? ""}' !== expected '${expectedName}'`,
      { expectedName, actualName: v2Service?.name ?? null },
      outFile,
    );
  }
  const v2Etag = typeof v2Service?.etag === "string" ? v2Service.etag : "";
  if (!v2Etag) {
    failClosed(
      "MISSING_SERVICE_ETAG",
      "Authoritative Cloud Run v2 Service response is missing top-level etag",
      { expectedName },
      outFile,
    );
  }
  const v2Uid = typeof v2Service?.uid === "string" ? v2Service.uid : "";
  if (!v2Uid) {
    failClosed(
      "MISSING_SERVICE_UID",
      "Authoritative Cloud Run v2 Service is missing uid",
      {},
      outFile,
    );
  }
  const v1Uid = typeof v1Service?.metadata?.uid === "string" ? v1Service.metadata.uid : "";
  if (v1Uid && v1Uid !== v2Uid) {
    failClosed(
      "V1_V2_UID_MISMATCH",
      `v1 metadata.uid ('${v1Uid}') !== v2 uid ('${v2Uid}')`,
      { v1Uid, v2Uid },
      outFile,
    );
  }
  if (expectedUid && v2Uid !== expectedUid) {
    failClosed(
      "SERVICE_UID_DRIFT",
      `v2 uid ('${v2Uid}') !== expected Stage 1 uid ('${expectedUid}')`,
      { expectedUid, v2Uid },
      outFile,
    );
  }

  const v1Gen = Number(v1Service?.metadata?.generation ?? 0);
  const v1ObsGen = Number(v1Service?.status?.observedGeneration ?? 0);
  const v2Gen = Number(v2Service?.generation ?? 0);
  const v2ObsGen = Number(v2Service?.observedGeneration ?? 0);
  if (
    !Number.isInteger(v1Gen) ||
    v1Gen <= 0 ||
    v1ObsGen !== v1Gen ||
    v2Gen !== v1Gen ||
    v2ObsGen !== v2Gen ||
    v2Service?.reconciling === true
  ) {
    failClosed(
      "V1_V2_GENERATION_OR_RECONCILING_MISMATCH",
      `v1/v2 generation or reconciling state invalid (v1=${v1Gen}/${v1ObsGen}, v2=${v2Gen}/${v2ObsGen}, reconciling=${v2Service?.reconciling})`,
      { v1Gen, v1ObsGen, v2Gen, v2ObsGen, reconciling: v2Service?.reconciling ?? null },
      outFile,
    );
  }

  const v1Traffic = analyzeTraffic(v1Service);
  const v2Desired = analyzeV2TrafficArray(v2Service?.traffic, "v2.traffic");
  const v2Serving = analyzeV2TrafficArray(v2Service?.trafficStatuses, "v2.trafficStatuses");
  if (!v1Traffic.valid || !v2Desired.valid || !v2Serving.valid) {
    failClosed(
      "INVALID_V1_OR_V2_TRAFFIC",
      `Traffic array invalid (v1=${v1Traffic.reason ?? "ok"}, v2Desired=${v2Desired.reason ?? "ok"}, v2Serving=${v2Serving.reason ?? "ok"})`,
      {},
      outFile,
    );
  }
  if (
    v1Traffic.entries100.length !== 1 ||
    v1Traffic.nonzeroEntries.length !== 1 ||
    v2Desired.entries100.length !== 1 ||
    v2Desired.nonzeroEntries.length !== 1 ||
    v2Serving.entries100.length !== 1 ||
    v2Serving.nonzeroEntries.length !== 1
  ) {
    failClosed(
      "NON_UNIQUE_100_PERCENT_REVISION",
      "Expected unique 100% traffic revision in v1, v2.traffic, and v2.trafficStatuses",
      {
        v1: v1Traffic.nonzeroEntries,
        v2Desired: v2Desired.nonzeroEntries,
        v2Serving: v2Serving.nonzeroEntries,
      },
      outFile,
    );
  }
  const rev100 = v2Serving.entries100[0].revisionName;
  if (
    v1Traffic.entries100[0].revisionName !== rev100 ||
    v2Desired.entries100[0].revisionName !== rev100
  ) {
    failClosed(
      "V1_V2_TRAFFIC_MISMATCH",
      `100% revision mismatch across v1/v2.traffic/v2.trafficStatuses (v1=${v1Traffic.entries100[0].revisionName}, desired=${v2Desired.entries100[0].revisionName}, serving=${rev100})`,
      {},
      outFile,
    );
  }
  const v1TagStr = stableJson(
    v1Traffic.tags.map((t) => ({ tag: t.tag, revisionName: t.revisionName })),
  );
  const v2DesTagStr = stableJson(
    v2Desired.tags.map((t) => ({ tag: t.tag, revisionName: t.revisionName })),
  );
  const v2SrvTagStr = stableJson(
    v2Serving.tags.map((t) => ({ tag: t.tag, revisionName: t.revisionName })),
  );
  if (v1TagStr !== v2DesTagStr || v1TagStr !== v2SrvTagStr) {
    failClosed(
      "V1_V2_TAG_MISMATCH",
      "Traffic tags disagree between v1, v2.traffic, and v2.trafficStatuses",
      { v1Tags: v1Traffic.tags, v2DesiredTags: v2Desired.tags, v2ServingTags: v2Serving.tags },
      outFile,
    );
  }

  const v1Sa = String(v1Service?.spec?.template?.spec?.serviceAccountName ?? "");
  const v2Sa = String(v2Service?.template?.serviceAccount ?? "");
  if (v2Sa && v1Sa && v2Sa !== v1Sa) {
    failClosed(
      "V1_V2_SERVICE_ACCOUNT_MISMATCH",
      `v1 serviceAccountName ('${v1Sa}') !== v2 template.serviceAccount ('${v2Sa}')`,
      {},
      outFile,
    );
  }

  return {
    uid: v2Uid,
    etag: v2Etag,
    generation: v2Gen,
    observedGeneration: v2ObsGen,
    prev100Revision: rev100,
    v1Traffic,
    v2Serving,
  };
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (cmd === "pre-stage1") {
  const serviceJson = readJsonFile(args["service-json"], "pre-stage1 v1 service JSON");
  const v2ServiceJson = readJsonFile(args["v2-service-json"], "pre-stage1 v2 service JSON");
  const project = String(args.project ?? "");
  const region = String(args.region ?? "");
  const service = String(args.service ?? "");
  const candTag = args["candidate-tag"];
  const snapshotOut = args["snapshot-out"];
  const envOut = args["env-out"];

  const bound = bindAndVerifyV1AndV2({
    v1Service: serviceJson,
    v2Service: v2ServiceJson,
    project,
    region,
    service,
    outFile: snapshotOut,
  });

  const tInfo = bound.v1Traffic;
  const prev100 = tInfo.entries100[0];
  if (!prev100.revisionName) {
    failClosed(
      "EMPTY_100_PERCENT_REVISION_NAME",
      "100% entry has empty revisionName",
      {},
      snapshotOut,
    );
  }

  const existingCollision = tInfo.tags.find((t) => t.tag === candTag);
  if (existingCollision) {
    failClosed(
      "CANDIDATE_TAG_ALREADY_IN_USE",
      `Candidate tag '${candTag}' already exists on revision '${existingCollision.revisionName}'`,
      { existingCollision },
      snapshotOut,
    );
  }

  const extracted = extractContainerAndSpec(serviceJson);
  const snapshot = {
    ok: true,
    schemaVersion: 2,
    capturedAtUtc: new Date().toISOString(),
    serviceName: String(serviceJson?.metadata?.name ?? ""),
    serviceUid: bound.uid,
    baseGeneration: bound.generation,
    baseEtag: bound.etag,
    prev100Revision: prev100.revisionName,
    prev100TrafficIndex: prev100.index,
    preservedTrafficTags: tInfo.tags,
    activeImageBeforeDeploy: extracted.image,
    config: extracted.configModel,
    configFingerprintSha256: extracted.configFingerprintSha256,
  };

  fs.writeFileSync(snapshotOut, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  if (envOut) {
    writeShellEnv(envOut, {
      PREV_100_REVISION: snapshot.prev100Revision,
      BASE_GENERATION: String(snapshot.baseGeneration),
      SERVICE_UID: snapshot.serviceUid,
      CONFIG_FINGERPRINT_SHA256: snapshot.configFingerprintSha256,
    });
  }
  process.stderr.write(
    `[cloudrun-state-guard] pre-stage1 OK: uid=${bound.uid}, prev100Revision=${snapshot.prev100Revision}, generation=${bound.generation}, etag=${bound.etag}\n`,
  );
  process.exit(0);
}

if (cmd === "extract-digest") {
  const buildJson = readJsonFile(args["build-json"], "Cloud Build JSON");
  const envOut = args["env-out"];

  let digest = "";
  const resultsImages = buildJson?.results?.images;
  if (Array.isArray(resultsImages) && resultsImages.length > 0) {
    digest = String(resultsImages[0]?.digest ?? "");
  }
  if (!digest && typeof buildJson?.imageDigest === "string") {
    digest = buildJson.imageDigest;
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    failClosed(
      "MISSING_IMMUTABLE_IMAGE_DIGEST",
      `Build result did not contain a valid sha256:<64-hex> digest (got '${digest}')`,
    );
  }
  const buildId = String(buildJson?.id ?? "unknown-build-id");
  writeShellEnv(envOut, {
    BUILT_IMAGE_DIGEST: digest,
    CLOUD_BUILD_ID: buildId,
  });
  process.stderr.write(`[cloudrun-state-guard] extract-digest OK: ${digest} (build=${buildId})\n`);
  process.exit(0);
}

if (cmd === "post-stage1-diff") {
  const snapshot = readJsonFile(args["snapshot-json"], "pre-stage1 snapshot");
  const postService = readJsonFile(args["service-json"], "post-stage1 v1 service JSON");
  const postV2Service = args["v2-service-json"]
    ? readJsonFile(args["v2-service-json"], "post-stage1 v2 service JSON")
    : null;
  const candRevisionJson = readJsonFile(args["revision-json"], "candidate revision JSON");
  const project = String(args.project ?? "");
  const region = String(args.region ?? "");
  const service = String(args.service ?? "");
  const expectedCandRevision = args["expected-revision"];
  const expectedCandTag = args["candidate-tag"];
  const expectedImageDigest = args["expected-digest"];
  const diffOut = args["diff-out"];
  const envOut = args["env-out"];

  if (postV2Service) {
    bindAndVerifyV1AndV2({
      v1Service: postService,
      v2Service: postV2Service,
      project,
      region,
      service,
      expectedUid: snapshot.serviceUid,
      outFile: diffOut,
    });
  }

  const postGen = Number(postService?.metadata?.generation ?? 0);
  const postObservedGen = Number(postService?.status?.observedGeneration ?? postGen);
  const latestCreated = String(postService?.status?.[LATEST_CREATED_FIELD] ?? "");
  const latestReady = String(postService?.status?.[LATEST_READY_FIELD] ?? "");

  const issues = [];
  if (postGen <= snapshot.baseGeneration || postObservedGen !== postGen) {
    issues.push(
      `Unexpected post-stage1 generation (base=${snapshot.baseGeneration}, post=${postGen}, observed=${postObservedGen})`,
    );
  }
  if (latestCreated && latestCreated !== expectedCandRevision) {
    issues.push(
      `Concurrent foreign revision detected: status.${LATEST_CREATED_FIELD}='${latestCreated}' !== expected '${expectedCandRevision}'`,
    );
  }
  if (latestReady && latestReady !== expectedCandRevision) {
    issues.push(
      `Revision readiness mismatch: status.${LATEST_READY_FIELD}='${latestReady}' !== expected '${expectedCandRevision}'`,
    );
  }

  const tInfo = analyzeTraffic(postService);
  if (!tInfo.valid) {
    issues.push(`Invalid post-deploy traffic: ${tInfo.reason}`);
  } else {
    if (
      tInfo.entries100.length !== 1 ||
      tInfo.nonzeroEntries.length !== 1 ||
      tInfo.entries100[0].revisionName !== snapshot.prev100Revision
    ) {
      issues.push(
        `100% production traffic changed during Stage 1! Expected ${snapshot.prev100Revision}=100%, got ${JSON.stringify(tInfo.nonzeroEntries)}`,
      );
    }

    for (const oldTag of snapshot.preservedTrafficTags) {
      const found = tInfo.tags.find((t) => t.tag === oldTag.tag);
      if (!found || found.revisionName !== oldTag.revisionName) {
        issues.push(
          `Pre-existing tag '${oldTag.tag}' drifted (expected '${oldTag.revisionName}', got '${found?.revisionName ?? "MISSING"}')`,
        );
      }
    }
  }

  const candTagEntry = tInfo.valid ? tInfo.tags.find((t) => t.tag === expectedCandTag) : null;
  const allowLoopbackUrl = process.env.ALLOW_LOOPBACK_CANDIDATE_URL === "1";
  const isValidCandUrl =
    typeof candTagEntry?.url === "string" &&
    (candTagEntry.url.startsWith("https://") ||
      (allowLoopbackUrl && candTagEntry.url.startsWith("http://127.0.0.1:")));
  if (
    !candTagEntry ||
    candTagEntry.revisionName !== expectedCandRevision ||
    candTagEntry.percent !== 0 ||
    !isValidCandUrl
  ) {
    issues.push(
      `Candidate tag '${expectedCandTag}' invalid: ${JSON.stringify(candTagEntry ?? null)}`,
    );
  }

  const revName = String(candRevisionJson?.metadata?.name ?? "");
  if (revName !== expectedCandRevision) {
    issues.push(`Revision metadata.name '${revName}' !== expected '${expectedCandRevision}'`);
  }

  const postServiceConfig = extractContainerAndSpec(postService);
  const candRevExtracted = extractContainerAndSpec(candRevisionJson);

  if (!candRevExtracted.image.endsWith(`@${expectedImageDigest}`)) {
    issues.push(
      `Candidate revision image '${candRevExtracted.image}' is not pinned to expected digest '@${expectedImageDigest}'`,
    );
  }

  const serviceConfigDiffs = compareConfigs(snapshot.config, postServiceConfig.configModel);
  const revisionConfigDiffs = compareConfigs(snapshot.config, candRevExtracted.configModel);

  const preserved =
    issues.length === 0 && serviceConfigDiffs.length === 0 && revisionConfigDiffs.length === 0;

  const report = {
    ok: preserved,
    preserved,
    checkedAtUtc: new Date().toISOString(),
    baseGeneration: snapshot.baseGeneration,
    postStage1Generation: postGen,
    prev100Revision: snapshot.prev100Revision,
    prev100Still100Percent:
      tInfo.valid &&
      tInfo.entries100.length === 1 &&
      tInfo.entries100[0].revisionName === snapshot.prev100Revision,
    candidateTag: expectedCandTag,
    candidateRevision: expectedCandRevision,
    candidateUrl: candTagEntry?.url ?? null,
    expectedImageDigest,
    observedCandidateRevisionImage: candRevExtracted.image,
    preservedPreExistingTagCount: snapshot.preservedTrafficTags.length,
    allPostStage1Tags: tInfo.valid ? tInfo.tags : [],
    serviceConfigDiffs,
    revisionConfigDiffs,
    issues,
  };

  fs.writeFileSync(diffOut, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (!preserved) {
    failClosed(
      "STAGE1_POST_DEPLOY_INVARIANT_OR_CONFIG_DRIFT",
      `Post-Stage 1 verification failed: ${[...issues, ...serviceConfigDiffs.map((d) => `service.${d.field}`), ...revisionConfigDiffs.map((d) => `revision.${d.field}`)].join("; ")}`,
      report,
    );
  }

  if (envOut) {
    writeShellEnv(envOut, {
      CAND_URL: candTagEntry.url,
      POST_STAGE1_GENERATION: String(postGen),
    });
  }
  process.stderr.write(
    `[cloudrun-state-guard] post-stage1-diff OK: ${expectedCandRevision} @ 0% (${candTagEntry.url}), config & ${snapshot.preservedTrafficTags.length} pre-existing tags 100% preserved\n`,
  );
  process.exit(0);
}

if (cmd === "seal-stage1-receipt") {
  const snapshot = readJsonFile(args["snapshot-json"], "snapshot");
  const diffReport = readJsonFile(args["diff-json"], "diff report");
  const verifyReport = readJsonFile(args["verify-json"], "candidate runtime verify report");
  const receiptOut = args["receipt-out"];

  if (!diffReport.preserved || !verifyReport.ok) {
    failClosed(
      "CANNOT_SEAL_UNVERIFIED_STAGE1",
      `Refusing to seal Stage 1 receipt (preserved=${diffReport.preserved}, runtimeVerifyOk=${verifyReport.ok})`,
    );
  }

  const now = Date.now();
  const receiptCore = {
    schemaVersion: 2,
    project: args.project,
    region: args.region,
    service: args.service,
    serviceUid: snapshot.serviceUid,
    targetSha: args["target-sha"],
    expectedServerVersion: args["expected-version"],
    candidateTag: diffReport.candidateTag,
    candidateRevision: diffReport.candidateRevision,
    candidateUrl: diffReport.candidateUrl,
    imageDigest: diffReport.expectedImageDigest,
    uiHtmlSha256: verifyReport.observedUiHtmlSha256,
    baseGeneration: snapshot.baseGeneration,
    postStage1Generation: diffReport.postStage1Generation,
    prev100Revision: snapshot.prev100Revision,
    preservedTrafficTags: diffReport.allPostStage1Tags,
    config: snapshot.config,
    configFingerprintSha256: snapshot.configFingerprintSha256,
    verifiedAtUtc: new Date(now).toISOString(),
    verifiedEpochMs: now,
  };
  const receiptIntegritySha256 = sha256Hex(stableJson(receiptCore));
  const fullReceipt = {
    ...receiptCore,
    receiptIntegritySha256,
  };
  fs.writeFileSync(receiptOut, `${JSON.stringify(fullReceipt, null, 2)}\n`, "utf8");
  process.stderr.write(
    `[cloudrun-state-guard] seal-stage1-receipt OK: sha256=${receiptIntegritySha256}\n`,
  );
  process.exit(0);
}

function parseStrictMaxAgeSeconds(rawVal, outFile = null) {
  const str = String(rawVal ?? "").trim();
  if (!/^[1-9][0-9]*$/.test(str)) {
    failClosed(
      "INVALID_MAX_AGE_SECONDS",
      `max-age-seconds must be a finite positive integer in [1, 86400]; got '${String(rawVal)}'`,
      { rawValue: rawVal ?? null },
      outFile,
    );
  }
  const n = Number(str);
  if (!Number.isSafeInteger(n) || n < 1 || n > 86400) {
    failClosed(
      "INVALID_MAX_AGE_SECONDS",
      `max-age-seconds out of allowed range [1, 86400]; got '${str}'`,
      { rawValue: rawVal ?? null, parsedValue: n },
      outFile,
    );
  }
  return n;
}

if (cmd === "pre-stage2-gate") {
  const receipt = readJsonFile(args["receipt-json"], "Stage 1 verified receipt");
  const liveService = readJsonFile(args["service-json"], "live service JSON");
  const liveRevision = readJsonFile(args["revision-json"], "live candidate revision JSON");
  const gateOut = args["gate-out"];
  const envOut = args["env-out"];
  const maxAgeSec = parseStrictMaxAgeSeconds(args["max-age-seconds"], gateOut);

  const { receiptIntegritySha256, ...receiptCore } = receipt;
  if (sha256Hex(stableJson(receiptCore)) !== receiptIntegritySha256) {
    failClosed(
      "RECEIPT_INTEGRITY_MISMATCH",
      "Stage 1 receipt SHA-256 integrity check failed",
      {},
      gateOut,
    );
  }

  const nowMs = Date.now();
  const verifiedEpochMs = Number(receipt.verifiedEpochMs);
  const parsedUtcMs = Date.parse(String(receipt.verifiedAtUtc ?? ""));
  if (
    !Number.isFinite(verifiedEpochMs) ||
    !Number.isFinite(parsedUtcMs) ||
    Math.abs(verifiedEpochMs - parsedUtcMs) > 1000
  ) {
    failClosed(
      "INVALID_RECEIPT_TIMESTAMP",
      `Receipt timestamp fields are invalid or inconsistent (verifiedEpochMs=${receipt.verifiedEpochMs}, verifiedAtUtc=${receipt.verifiedAtUtc})`,
      { verifiedEpochMs: receipt.verifiedEpochMs, verifiedAtUtc: receipt.verifiedAtUtc },
      gateOut,
    );
  }
  if (verifiedEpochMs > nowMs + 5000) {
    failClosed(
      "FUTURE_RECEIPT_TIMESTAMP",
      `Stage 1 receipt timestamp (${verifiedEpochMs}) is in the future relative to current clock (${nowMs})`,
      { verifiedEpochMs, nowMs },
      gateOut,
    );
  }
  const ageMs = nowMs - verifiedEpochMs;
  if (ageMs > maxAgeSec * 1000) {
    failClosed(
      "STALE_STAGE1_VERIFICATION_RECEIPT",
      `Stage 1 receipt age (${ageMs}ms) exceeds freshness limit (${maxAgeSec * 1000}ms)`,
      { ageMs, maxAgeMs: maxAgeSec * 1000 },
      gateOut,
    );
  }

  const liveGen = Number(liveService?.metadata?.generation ?? 0);
  const liveObservedGen = Number(liveService?.status?.observedGeneration ?? liveGen);
  if (liveGen !== receipt.postStage1Generation || liveObservedGen !== liveGen) {
    failClosed(
      "GENERATION_CONFLICT",
      `Service generation drifted since Stage 1 receipt (expected=${receipt.postStage1Generation}, live=${liveGen}, observed=${liveObservedGen})`,
      { expectedGeneration: receipt.postStage1Generation, liveGen, liveObservedGen },
      gateOut,
    );
  }

  const latestCreated = String(liveService?.status?.[LATEST_CREATED_FIELD] ?? "");
  if (latestCreated && latestCreated !== receipt.candidateRevision) {
    failClosed(
      "FOREIGN_LATEST_REVISION_CONFLICT",
      `Concurrent foreign revision detected (${latestCreated} !== ${receipt.candidateRevision})`,
      { latestCreated, expectedCandidateRevision: receipt.candidateRevision },
      gateOut,
    );
  }

  const tInfo = analyzeTraffic(liveService);
  if (!tInfo.valid || tInfo.entries100.length !== 1 || tInfo.nonzeroEntries.length !== 1) {
    failClosed(
      "PRE_PROMOTE_TRAFFIC_NOT_SINGLE_100",
      "Live traffic is not a single 100% active revision",
      { trafficInfo: tInfo },
      gateOut,
    );
  }
  if (tInfo.entries100[0].revisionName !== receipt.prev100Revision) {
    failClosed(
      "ACTIVE_100_REVISION_DRIFT",
      `Active 100% revision ('${tInfo.entries100[0].revisionName}') no longer matches receipt prev100Revision ('${receipt.prev100Revision}')`,
      { live100: tInfo.entries100[0].revisionName, expected100: receipt.prev100Revision },
      gateOut,
    );
  }

  if (stableJson(tInfo.tags) !== stableJson(receipt.preservedTrafficTags)) {
    failClosed(
      "TAG_BINDINGS_DRIFT",
      "Traffic tags drifted between Stage 1 receipt and Stage 2 promotion gate",
      { expectedTags: receipt.preservedTrafficTags, liveTags: tInfo.tags },
      gateOut,
    );
  }

  const candTagEntry = tInfo.tags.find((t) => t.tag === receipt.candidateTag);
  if (!candTagEntry || candTagEntry.revisionName !== receipt.candidateRevision) {
    failClosed(
      "CANDIDATE_TAG_DRIFT",
      `Candidate tag '${receipt.candidateTag}' no longer points to '${receipt.candidateRevision}'`,
      { candTagEntry },
      gateOut,
    );
  }

  const revExtracted = extractContainerAndSpec(liveRevision);
  if (!revExtracted.image.endsWith(`@${receipt.imageDigest}`)) {
    failClosed(
      "CANDIDATE_IMAGE_DIGEST_DRIFT",
      `Candidate revision image ('${revExtracted.image}') does not match pinned digest '@${receipt.imageDigest}'`,
      { liveImage: revExtracted.image, expectedDigest: receipt.imageDigest },
      gateOut,
    );
  }

  const revDiffs = compareConfigs(receipt.config, revExtracted.configModel);
  const svcExtracted = extractContainerAndSpec(liveService);
  const svcDiffs = compareConfigs(receipt.config, svcExtracted.configModel);
  if (revDiffs.length > 0 || svcDiffs.length > 0) {
    failClosed(
      "CONFIG_OR_SECRET_DRIFT",
      "Service or candidate revision configuration/SecretRefs/SA drifted before Stage 2 cutover",
      { revDiffs, svcDiffs },
      gateOut,
    );
  }

  const liveV2Service = readJsonFile(args["v2-service-json"], "live v2 service JSON");
  const bound = bindAndVerifyV1AndV2({
    v1Service: liveService,
    v2Service: liveV2Service,
    project: receipt.project,
    region: receipt.region,
    service: receipt.service,
    expectedUid: receipt.serviceUid,
    outFile: gateOut,
  });
  const liveEtag = bound.etag;

  const tagMapArg = formatTagMapArg(receipt.preservedTrafficTags);
  const v2TrafficPromote = [
    {
      type: "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION",
      revision: receipt.candidateRevision,
      percent: 100,
    },
    ...receipt.preservedTrafficTags.map((t) => ({
      type: "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION",
      revision: t.revisionName,
      percent: 0,
      tag: t.tag,
    })),
  ];
  const _v2TrafficRollback = [
    {
      type: "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION",
      revision: receipt.prev100Revision,
      percent: 100,
    },
    ...receipt.preservedTrafficTags.map((t) => ({
      type: "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION",
      revision: t.revisionName,
      percent: 0,
      tag: t.tag,
    })),
  ];

  const promotePatchPath = args["promote-patch-out"];
  if (promotePatchPath) {
    fs.writeFileSync(
      promotePatchPath,
      `${JSON.stringify({ etag: liveEtag, traffic: v2TrafficPromote }, null, 2)}\n`,
      "utf8",
    );
  }

  const gateResult = {
    ok: true,
    checkedAtUtc: new Date().toISOString(),
    candidateRevision: receipt.candidateRevision,
    candidateUrl: receipt.candidateUrl,
    prev100Revision: receipt.prev100Revision,
    preCutoverGeneration: liveGen,
    preCutoverEtag: liveEtag,
    expectedVersion: receipt.expectedServerVersion,
    expectedUiHtmlSha256: receipt.uiHtmlSha256,
    promoteToRevisionsArg: `${receipt.candidateRevision}=100`,
    rollbackToRevisionsArg: `${receipt.prev100Revision}=100`,
    updateTagsArg: tagMapArg,
  };
  fs.writeFileSync(gateOut, `${JSON.stringify(gateResult, null, 2)}\n`, "utf8");
  writeShellEnv(envOut, {
    PINNED_CAND_REVISION: receipt.candidateRevision,
    PINNED_CAND_URL: receipt.candidateUrl,
    PINNED_PREV_100_REVISION: receipt.prev100Revision,
    PRE_CUTOVER_GENERATION: String(liveGen),
    PRE_CUTOVER_ETAG: liveEtag,
    EXPECTED_SERVER_VERSION: receipt.expectedServerVersion,
    EXPECTED_UI_HTML_SHA256: receipt.uiHtmlSha256,
    PROMOTE_TO_REVISIONS_ARG: gateResult.promoteToRevisionsArg,
    ROLLBACK_TO_REVISIONS_ARG: gateResult.rollbackToRevisionsArg,
    PRESERVED_TAGS_ARG: tagMapArg,
  });
  process.stderr.write(
    `[cloudrun-state-guard] pre-stage2-gate OK: ready to promote ${receipt.candidateRevision}=100 with etag=${liveEtag}\n`,
  );
  process.exit(0);
}

if (cmd === "post-cutover-check") {
  const receipt = readJsonFile(args["receipt-json"], "Stage 1 receipt");
  const postService = readJsonFile(args["service-json"], "post-cutover service JSON");
  const envOut = args["env-out"];

  const postGen = Number(postService?.metadata?.generation ?? 0);
  const obsGen = Number(postService?.status?.observedGeneration ?? postGen);
  const tInfo = analyzeTraffic(postService);

  if (
    !tInfo.valid ||
    obsGen !== postGen ||
    tInfo.entries100.length !== 1 ||
    tInfo.nonzeroEntries.length !== 1 ||
    tInfo.entries100[0].revisionName !== receipt.candidateRevision
  ) {
    failClosed(
      "POST_CUTOVER_STATE_MISMATCH",
      `Post-cutover service state did not converge on ${receipt.candidateRevision}=100`,
      { postGen, obsGen, trafficInfo: tInfo },
    );
  }

  for (const expectedTag of receipt.preservedTrafficTags) {
    const found = tInfo.tags.find((t) => t.tag === expectedTag.tag);
    if (!found || found.revisionName !== expectedTag.revisionName) {
      failClosed(
        "POST_CUTOVER_TAG_LOSS",
        `Tag '${expectedTag.tag}' lost or altered during cutover`,
        { expectedTag, found },
      );
    }
  }

  writeShellEnv(envOut, {
    CONFIRMED_CUTOVER_GENERATION: String(postGen),
  });
  process.stderr.write(
    `[cloudrun-state-guard] post-cutover-check OK: ${receipt.candidateRevision}=100 confirmed at generation=${postGen}\n`,
  );
  process.exit(0);
}

if (cmd === "pre-rollback-ownership-check") {
  const receipt = readJsonFile(args["receipt-json"], "Stage 1 receipt");
  const currentService = readJsonFile(args["service-json"], "current service JSON before rollback");
  const confirmedCutoverGen = Number(args["confirmed-cutover-generation"] ?? 0);
  const outJson = args["out-json"];

  const curGen = Number(currentService?.metadata?.generation ?? 0);
  const obsGen = Number(currentService?.status?.observedGeneration ?? curGen);
  const latestCreated = String(currentService?.status?.[LATEST_CREATED_FIELD] ?? "");
  const tInfo = analyzeTraffic(currentService);

  const thirdPartyReasons = [];
  if (curGen !== confirmedCutoverGen || obsGen !== curGen) {
    thirdPartyReasons.push(
      `generation changed after cutover (confirmed=${confirmedCutoverGen}, current=${curGen}, observed=${obsGen})`,
    );
  }
  if (latestCreated && latestCreated !== receipt.candidateRevision) {
    thirdPartyReasons.push(
      `concurrent foreign revision created (${latestCreated} !== ${receipt.candidateRevision})`,
    );
  }
  if (
    !tInfo.valid ||
    tInfo.entries100.length !== 1 ||
    tInfo.nonzeroEntries.length !== 1 ||
    tInfo.entries100[0].revisionName !== receipt.candidateRevision
  ) {
    thirdPartyReasons.push(
      `active 100% traffic is no longer owned by candidate '${receipt.candidateRevision}'`,
    );
  }

  if (thirdPartyReasons.length > 0) {
    const payload = {
      ok: false,
      ownershipConfirmed: false,
      errorCode: "THIRD_PARTY_OR_CONCURRENT_CHANGE_NO_ROLLBACK",
      reasons: thirdPartyReasons,
      recordedAtUtc: new Date().toISOString(),
    };
    fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    process.stderr.write(
      `[cloudrun-state-guard] [THIRD_PARTY_OR_CONCURRENT_CHANGE_NO_ROLLBACK] Refusing rollback: ${thirdPartyReasons.join("; ")}\n`,
    );
    process.exit(41);
  }

  const currentV2Service = readJsonFile(
    args["v2-service-json"],
    "current v2 service JSON before rollback",
  );
  const v2Name = `projects/${receipt.project}/locations/${receipt.region}/services/${receipt.service}`;
  const curEtag = typeof currentV2Service?.etag === "string" ? currentV2Service.etag : "";
  const curV2Uid = typeof currentV2Service?.uid === "string" ? currentV2Service.uid : "";
  const curV2Gen = Number(currentV2Service?.generation ?? 0);
  const curV2ObsGen = Number(currentV2Service?.observedGeneration ?? 0);
  const curV2Serving = analyzeV2TrafficArray(
    currentV2Service?.trafficStatuses,
    "v2.trafficStatuses",
  );

  if (
    String(currentV2Service?.name ?? "") !== v2Name ||
    !curEtag ||
    !curV2Uid ||
    curV2Uid !== receipt.serviceUid
  ) {
    const payload = {
      ok: false,
      ownershipConfirmed: false,
      errorCode: "V2_SERVICE_OR_ETAG_INVALID_NO_ROLLBACK",
      reasons: ["Current v2 Service missing valid name/uid/etag for conditional rollback"],
      recordedAtUtc: new Date().toISOString(),
    };
    fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    process.exit(41);
  }
  if (
    curV2Gen !== confirmedCutoverGen ||
    curV2ObsGen !== curV2Gen ||
    currentV2Service?.reconciling === true ||
    !curV2Serving.valid ||
    curV2Serving.entries100.length !== 1 ||
    curV2Serving.entries100[0].revisionName !== receipt.candidateRevision
  ) {
    const payload = {
      ok: false,
      ownershipConfirmed: false,
      errorCode: "THIRD_PARTY_OR_CONCURRENT_CHANGE_NO_ROLLBACK",
      reasons: [
        `v2 serving state/generation drifted (gen=${curV2Gen}/${curV2ObsGen}, reconciling=${currentV2Service?.reconciling})`,
      ],
      recordedAtUtc: new Date().toISOString(),
    };
    fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    process.exit(41);
  }

  const rollbackPatchPath = args["rollback-patch-out"];
  if (rollbackPatchPath) {
    const v2TrafficRollback = [
      {
        type: "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION",
        revision: receipt.prev100Revision,
        percent: 100,
      },
      ...receipt.preservedTrafficTags.map((t) => ({
        type: "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION",
        revision: t.revisionName,
        percent: 0,
        tag: t.tag,
      })),
    ];
    fs.writeFileSync(
      rollbackPatchPath,
      `${JSON.stringify({ etag: curEtag, traffic: v2TrafficRollback }, null, 2)}\n`,
      "utf8",
    );
  }

  const okPayload = {
    ok: true,
    ownershipConfirmed: true,
    candidateRevision: receipt.candidateRevision,
    rollbackRevision: receipt.prev100Revision,
    confirmedCutoverGeneration: confirmedCutoverGen,
    rollbackEtag: curEtag,
    recordedAtUtc: new Date().toISOString(),
  };
  fs.writeFileSync(outJson, `${JSON.stringify(okPayload, null, 2)}\n`, "utf8");
  process.stderr.write(
    `[cloudrun-state-guard] pre-rollback-ownership-check OK: etag=${curEtag}, permitting 1-time conditional rollback to ${receipt.prev100Revision}=100\n`,
  );
  process.exit(0);
}

if (cmd === "post-rollback-verify") {
  const receipt = readJsonFile(args["receipt-json"], "Stage 1 receipt");
  const postRollbackService = readJsonFile(args["service-json"], "post-rollback v1 service JSON");
  const postRollbackV2 = readJsonFile(args["v2-service-json"], "post-rollback v2 service JSON");
  const outJson = args["out-json"];

  const gen = Number(postRollbackService?.metadata?.generation ?? 0);
  const obsGen = Number(postRollbackService?.status?.observedGeneration ?? gen);
  const tInfo = analyzeTraffic(postRollbackService);
  const v2Gen = Number(postRollbackV2?.generation ?? 0);
  const v2ObsGen = Number(postRollbackV2?.observedGeneration ?? 0);
  const v2Serving = analyzeV2TrafficArray(postRollbackV2?.trafficStatuses, "v2.trafficStatuses");

  const errors = [];
  if (
    obsGen !== gen ||
    v2ObsGen !== v2Gen ||
    v2Gen !== gen ||
    postRollbackV2?.reconciling === true
  ) {
    errors.push(
      `v1/v2 generation/reconciling mismatch (v1=${obsGen}/${gen}, v2=${v2ObsGen}/${v2Gen}, reconciling=${postRollbackV2?.reconciling})`,
    );
  }
  if (
    !tInfo.valid ||
    tInfo.entries100.length !== 1 ||
    tInfo.nonzeroEntries.length !== 1 ||
    tInfo.entries100[0].revisionName !== receipt.prev100Revision
  ) {
    errors.push(
      `v1 100% traffic was NOT restored to '${receipt.prev100Revision}' (observed=${JSON.stringify(tInfo.nonzeroEntries)})`,
    );
  }
  if (
    !v2Serving.valid ||
    v2Serving.entries100.length !== 1 ||
    v2Serving.nonzeroEntries.length !== 1 ||
    v2Serving.entries100[0].revisionName !== receipt.prev100Revision
  ) {
    errors.push(
      `v2.trafficStatuses 100% serving traffic was NOT restored to '${receipt.prev100Revision}' (observed=${JSON.stringify(v2Serving.nonzeroEntries)})`,
    );
  }
  for (const tagEntry of receipt.preservedTrafficTags) {
    const found = tInfo.tags.find((t) => t.tag === tagEntry.tag);
    if (!found || found.revisionName !== tagEntry.revisionName) {
      errors.push(
        `Tag '${tagEntry.tag}' not preserved after rollback (expected '${tagEntry.revisionName}', got '${found?.revisionName ?? "MISSING"}')`,
      );
    }
  }

  const res = {
    ok: errors.length === 0,
    restoredRevision: receipt.prev100Revision,
    observedGeneration: obsGen,
    errors,
    verifiedAtUtc: new Date().toISOString(),
  };
  fs.writeFileSync(outJson, `${JSON.stringify(res, null, 2)}\n`, "utf8");
  if (errors.length > 0) {
    process.stderr.write(
      `[cloudrun-state-guard] [POST_ROLLBACK_VERIFICATION_FAILED] ${errors.join("; ")}\n`,
    );
    process.exit(43);
  }
  process.stderr.write(
    `[cloudrun-state-guard] post-rollback-verify OK: ${receipt.prev100Revision}=100 & all tags verified\n`,
  );
  process.exit(0);
}

if (cmd === "journal") {
  const journalFile = args["journal-json"];
  const scriptName = String(args.script ?? "unknown-script");
  const phase = String(args.phase ?? "UNKNOWN_PHASE");
  const status = String(args.status ?? "INFO");
  const outcome = args.outcome ? String(args.outcome) : null;
  const exitCode = args["exit-code"] !== undefined ? Number(args["exit-code"]) : null;
  const detail = String(args.detail ?? "");
  const trafficMutations =
    args["traffic-mutations"] !== undefined ? Number(args["traffic-mutations"]) : undefined;
  const rollbackAttempts =
    args["rollback-attempts"] !== undefined ? Number(args["rollback-attempts"]) : undefined;
  const obsServicePath = args["service-json"] || null;

  let doc = {
    schemaVersion: 1,
    script: scriptName,
    startedAtUtc: new Date().toISOString(),
    currentPhase: phase,
    currentStatus: status,
    finalOutcome: null,
    lastExitCode: null,
    trafficMutations: 0,
    rollbackAttempts: 0,
    events: [],
  };
  if (fs.existsSync(journalFile)) {
    const rawJournal = fs.readFileSync(journalFile, "utf8");
    const parsed = JSON.parse(rawJournal);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.events)) {
      throw new Error(`Corrupt phase-journal.json structure in ${journalFile}`);
    }
    doc = parsed;
  }

  let observedServiceSummary;
  if (obsServicePath && fs.existsSync(obsServicePath)) {
    try {
      const svc = JSON.parse(fs.readFileSync(obsServicePath, "utf8"));
      const tInfo = analyzeTraffic(svc);
      observedServiceSummary = {
        generation: svc?.metadata?.generation ?? null,
        observedGeneration: svc?.status?.observedGeneration ?? null,
        nonzeroTraffic: tInfo.valid ? tInfo.nonzeroEntries : [],
        tags: tInfo.valid ? tInfo.tags : [],
      };
    } catch (e) {
      observedServiceSummary = { parseError: e.message };
    }
  }

  doc.currentPhase = phase;
  doc.currentStatus = status;
  doc.updatedAtUtc = new Date().toISOString();
  if (outcome !== null) {
    doc.finalOutcome = outcome;
  }
  if (exitCode !== null && !Number.isNaN(exitCode)) {
    doc.lastExitCode = exitCode;
  }
  if (trafficMutations !== undefined && !Number.isNaN(trafficMutations)) {
    doc.trafficMutations = trafficMutations;
  }
  if (rollbackAttempts !== undefined && !Number.isNaN(rollbackAttempts)) {
    doc.rollbackAttempts = rollbackAttempts;
  }

  const entry = {
    seq: doc.events.length + 1,
    atUtc: doc.updatedAtUtc,
    script: scriptName,
    phase,
    status,
    detail,
  };
  if (outcome !== null) entry.outcome = outcome;
  if (exitCode !== null && !Number.isNaN(exitCode)) entry.exitCode = exitCode;
  if (observedServiceSummary !== undefined) entry.observedService = observedServiceSummary;

  doc.events.push(entry);
  fs.writeFileSync(journalFile, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  process.exit(0);
}

if (cmd === "read-receipt-env") {
  const receipt = readJsonFile(args["receipt-json"], "Stage 1 verified receipt");
  const envOut = args["env-out"];
  const { receiptIntegritySha256, ...receiptCore } = receipt;
  if (sha256Hex(stableJson(receiptCore)) !== receiptIntegritySha256) {
    failClosed("RECEIPT_INTEGRITY_MISMATCH", "Stage 1 receipt SHA-256 integrity check failed");
  }
  writeShellEnv(envOut, {
    GCP_PROJECT: receipt.project,
    GCP_REGION: receipt.region,
    SERVICE_NAME: receipt.service,
    CAND_REVISION: receipt.candidateRevision,
    CAND_TAG: receipt.candidateTag,
    PREV_100_REVISION: receipt.prev100Revision,
  });
  process.exit(0);
}

if (cmd === "write-promotion-complete") {
  const receipt = readJsonFile(args["receipt-json"], "Stage 1 receipt");
  const candVerify = readJsonFile(args["cand-verify-json"], "post-cutover candidate verify JSON");
  const prodVerify = readJsonFile(args["prod-verify-json"], "post-cutover production verify JSON");
  const outJson = args["out-json"];
  const confirmedGen = Number(args["confirmed-cutover-generation"] ?? 0);

  if (!candVerify.ok || !prodVerify.ok) {
    failClosed(
      "UNVERIFIED_PROMOTION_COMPLETE_REJECTED",
      "Cannot write promotion complete when verify failed",
    );
  }

  const summary = {
    ok: true,
    finalOutcome: "PROMOTED_AND_VERIFIED",
    completedAtUtc: new Date().toISOString(),
    project: receipt.project,
    region: receipt.region,
    service: receipt.service,
    promotedRevision: receipt.candidateRevision,
    previous100Revision: receipt.prev100Revision,
    confirmedCutoverGeneration: confirmedGen,
    imageDigest: receipt.imageDigest,
    targetSha: receipt.targetSha,
    uiHtmlSha256: receipt.uiHtmlSha256,
    preservedTrafficTags: receipt.preservedTrafficTags,
    candidateRuntimeChecksPassed: candVerify.passedChecks,
    productionRuntimeChecksPassed: prodVerify.passedChecks,
  };
  fs.writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  process.exit(0);
}

if (cmd === "check-freshness-before-patch") {
  const receipt = readJsonFile(args["receipt-json"], "Stage 1 verified receipt");
  const maxAgeSec = parseStrictMaxAgeSeconds(args["max-age-seconds"], null);
  const nowMs = Date.now();
  const verifiedEpochMs = Number(receipt.verifiedEpochMs);
  if (!Number.isFinite(verifiedEpochMs) || verifiedEpochMs > nowMs + 5000) {
    failClosed(
      "INVALID_OR_FUTURE_RECEIPT_TIMESTAMP",
      "Invalid or future receipt timestamp right before patch",
    );
  }
  const ageMs = nowMs - verifiedEpochMs;
  if (ageMs > maxAgeSec * 1000) {
    failClosed(
      "STALE_STAGE1_VERIFICATION_RECEIPT",
      `Stage 1 receipt expired right before atomic patch (${ageMs}ms > ${maxAgeSec * 1000}ms)`,
    );
  }
  process.exit(0);
}

if (cmd === "check-patch-response") {
  const responseFile = args["response-json"];
  const httpCode = Number(args["http-code"] ?? 0);
  let parsed = null;
  try {
    if (fs.existsSync(responseFile)) {
      const txt = fs.readFileSync(responseFile, "utf8").trim();
      if (txt) parsed = JSON.parse(txt);
    }
  } catch {
    parsed = null;
  }
  const errCode = Number(parsed?.error?.code ?? httpCode);
  const errStatus = String(parsed?.error?.status ?? "");
  if (
    httpCode === 409 ||
    httpCode === 412 ||
    errCode === 409 ||
    errCode === 412 ||
    errStatus === "ABORTED" ||
    errStatus === "FAILED_PRECONDITION"
  ) {
    process.stderr.write(
      `[cloudrun-state-guard] [CONCURRENT_MODIFICATION_ABORTED] Server rejected conditional PATCH (http=${httpCode}, status=${errStatus}); third-party state untouched\n`,
    );
    process.exit(49);
  }
  if (httpCode < 200 || httpCode >= 300 || parsed?.error) {
    process.stderr.write(
      `[cloudrun-state-guard] [PATCH_API_ERROR] Conditional PATCH failed (http=${httpCode}): ${JSON.stringify(parsed?.error ?? null)}\n`,
    );
    process.exit(35);
  }
  process.exit(0);
}

if (cmd === "validate-api-url") {
  const rawUrl = String(args.url ?? "");
  const project = String(args.project ?? "");
  const region = String(args.region ?? "");
  const service = String(args.service ?? "");
  const kind = String(args.kind ?? "service");
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    failClosed("NON_GOOGLE_API_OVERRIDE", `Invalid Cloud Run API URL: '${rawUrl}'`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "run.googleapis.com" ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hash !== ""
  ) {
    failClosed(
      "NON_GOOGLE_API_OVERRIDE",
      `Rejected non-Google or non-canonical Cloud Run API URL: '${rawUrl}'`,
    );
  }
  const escapedProj = project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedReg = region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const _escapedSvc = service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (kind === "service" || kind === "service-patch") {
    const expectedPath = `/v2/projects/${project}/locations/${region}/services/${service}`;
    const expectedSearch = kind === "service-patch" ? "?updateMask=traffic" : "";
    if (parsed.pathname !== expectedPath || parsed.search !== expectedSearch) {
      failClosed(
        "NON_GOOGLE_API_OVERRIDE",
        `Unexpected Cloud Run v2 service path/query: '${parsed.pathname}${parsed.search}'`,
      );
    }
  } else if (kind === "operation") {
    const opRe = new RegExp(
      `^/v2/projects/${escapedProj}/locations/${escapedReg}/operations/[A-Za-z0-9._-]+$`,
    );
    if (!opRe.test(parsed.pathname) || parsed.search !== "") {
      failClosed(
        "NON_GOOGLE_API_OVERRIDE",
        `Unexpected Cloud Run v2 operation path/query: '${parsed.pathname}${parsed.search}'`,
      );
    }
  } else {
    failClosed("INVALID_API_URL_KIND", `Unknown validate-api-url kind '${kind}'`);
  }
  process.exit(0);
}

if (cmd === "validate-operation") {
  const opJson = readJsonFile(args["op-json"], "Cloud Run v2 Operation JSON");
  const project = String(args.project ?? "");
  const region = String(args.region ?? "");
  const envOut = args["env-out"];

  const opName = typeof opJson?.name === "string" ? opJson.name : "";
  const escapedProj = project.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedReg = region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const opNameRe = new RegExp(
    `^projects/${escapedProj}/locations/${escapedReg}/operations/[A-Za-z0-9._-]+$`,
  );

  if (!opNameRe.test(opName)) {
    failClosed(
      "INVALID_OPERATION_RESPONSE",
      `services.patch response is not a valid Cloud Run v2 Operation for ${project}/${region} (name='${opName}')`,
      { opName },
    );
  }
  if (opJson?.error) {
    process.stderr.write(
      `[cloudrun-state-guard] [OPERATION_FAILED] Operation '${opName}' failed: ${JSON.stringify(opJson.error)}\n`,
    );
    if (envOut) {
      writeShellEnv(envOut, {
        OP_NAME: opName,
        OP_DONE: String(Boolean(opJson?.done)),
        OP_HAS_ERROR: "true",
      });
    }
    process.exit(36);
  }
  const doneStr = opJson?.done === true ? "true" : "false";
  if (envOut) {
    writeShellEnv(envOut, {
      OP_NAME: opName,
      OP_DONE: doneStr,
      OP_HAS_ERROR: "false",
    });
  }
  process.stderr.write(
    `[cloudrun-state-guard] validate-operation OK: ${opName} (done=${doneStr})\n`,
  );
  process.exit(0);
}

if (cmd === "post-cutover-v2-convergence") {
  const receipt = readJsonFile(args["receipt-json"], "Stage 1 receipt");
  const v1Service = readJsonFile(args["service-json"], "post-cutover v1 service JSON");
  const v2Service = readJsonFile(args["v2-service-json"], "post-cutover v2 service JSON");
  const expectedRevision = String(args["expected-revision"] ?? receipt.candidateRevision);
  const minGen = Number(args["min-generation"] ?? 0);
  const envOut = args["env-out"];

  const bound = bindAndVerifyV1AndV2({
    v1Service,
    v2Service,
    project: receipt.project,
    region: receipt.region,
    service: receipt.service,
    expectedUid: receipt.serviceUid,
  });

  if (bound.generation < minGen) {
    failClosed(
      "POST_CUTOVER_GENERATION_REGRESSION",
      `Post-cutover generation (${bound.generation}) < min expected (${minGen})`,
    );
  }
  if (bound.prev100Revision !== expectedRevision) {
    failClosed(
      "POST_CUTOVER_STATE_MISMATCH",
      `Post-cutover serving trafficStatuses did not converge on '${expectedRevision}=100' (got '${bound.prev100Revision}')`,
    );
  }
  for (const expectedTag of receipt.preservedTrafficTags) {
    const found = bound.v2Serving.tags.find((t) => t.tag === expectedTag.tag);
    if (!found || found.revisionName !== expectedTag.revisionName) {
      failClosed(
        "POST_CUTOVER_TAG_LOSS",
        `Tag '${expectedTag.tag}' lost or altered in v2 trafficStatuses after cutover`,
        { expectedTag, found },
      );
    }
  }
  writeShellEnv(envOut, {
    CONFIRMED_CUTOVER_GENERATION: String(bound.generation),
    CONFIRMED_CUTOVER_ETAG: bound.etag,
  });
  process.stderr.write(
    `[cloudrun-state-guard] post-cutover-v2-convergence OK: ${expectedRevision}=100 converged at generation=${bound.generation}\n`,
  );
  process.exit(0);
}

failClosed("UNKNOWN_SUBCOMMAND", `Unknown subcommand '${cmd ?? ""}'`);
