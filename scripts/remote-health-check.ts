const remoteUrl = process.env.JP_BIDS_REMOTE_URL ?? "https://mcp.bid-jp.com";

async function check(path: string): Promise<void> {
  const url = new URL(path, remoteUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url.href} returned ${response.status}`);
  }
  console.error(`${url.href} OK`);
}

await check("/healthz");

const mcpGetResponse = await fetch(new URL("/mcp", remoteUrl), {
  headers: { Accept: "text/event-stream" },
});

if (mcpGetResponse.status !== 405) {
  throw new Error(
    `${new URL("/mcp", remoteUrl).href} expected 405 for GET, got ${mcpGetResponse.status}`,
  );
}

console.error(`${new URL("/mcp", remoteUrl).href} GET correctly returns 405`);
