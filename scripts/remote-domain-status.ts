import { execFileSync } from "node:child_process";

const domain = process.env.JP_BIDS_REMOTE_DOMAIN ?? "mcp.bid-jp.com";
const region = process.env.JP_BIDS_GCP_REGION ?? "asia-northeast1";
const project = process.env.JP_BIDS_GCP_PROJECT ?? "ssw-compass-prod-494613";

const output = execFileSync(
  "gcloud",
  [
    "beta",
    "run",
    "domain-mappings",
    "describe",
    "--domain",
    domain,
    "--region",
    region,
    "--project",
    project,
    "--format=json",
  ],
  { encoding: "utf8" },
);

const mapping = JSON.parse(output) as {
  status?: {
    conditions?: Array<{
      type?: string;
      status?: string;
      reason?: string;
      message?: string;
    }>;
    resourceRecords?: Array<{
      name: string;
      type: string;
      rrdata: string;
    }>;
  };
};

for (const condition of mapping.status?.conditions ?? []) {
  console.error(
    `${condition.type ?? "Unknown"}: ${condition.status ?? "Unknown"} ${condition.reason ?? ""} ${condition.message ?? ""}`.trim(),
  );
}

for (const record of mapping.status?.resourceRecords ?? []) {
  console.error(`DNS: ${record.name} ${record.type} ${record.rrdata}`);
}

const ready = mapping.status?.conditions?.some(
  (condition) => condition.type === "Ready" && condition.status === "True",
);
const certificateReady = mapping.status?.conditions?.some(
  (condition) => condition.type === "CertificateProvisioned" && condition.status === "True",
);

if (!ready || !certificateReady) {
  process.exit(1);
}

console.error(`${domain} is ready.`);
