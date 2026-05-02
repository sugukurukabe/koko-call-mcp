const remoteUrl = process.env.JP_BIDS_REMOTE_URL ?? "https://mcp.bid-jp.com";

async function check(path: string): Promise<void> {
  const url = new URL(path, remoteUrl);
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    const code =
      typeof cause === "object" && cause !== null && "code" in cause
        ? String(cause.code)
        : "UNKNOWN";
    throw new Error(
      [
        `${url.href} is not reachable yet (${code}).`,
        "If this is mcp.bid-jp.com, Cloud Run managed certificate provisioning may still be pending.",
        "Check with: npm run remote:domain",
      ].join(" "),
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new Error(`${url.href} returned ${response.status}`);
  }
  console.error(`${url.href} OK`);
}

try {
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
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
