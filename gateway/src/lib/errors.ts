// Gateway エラー型
// Gateway error types
// Tipe error Gateway

export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

export class PolicyDeniedError extends GatewayError {
  constructor(reason: string) {
    super(reason, "POLICY_DENIED");
  }
}

export class RateLimitError extends GatewayError {
  constructor(serverId: string) {
    super(`Rate limit exceeded for server: ${serverId}`, "RATE_LIMIT");
  }
}

export class RouterError extends GatewayError {
  constructor(query: string) {
    super(
      `No matching server found for query. Use list_connected_servers to see available servers and their keywords. Query: "${query}"`,
      "NO_ROUTE",
    );
  }
}

export class ProxyError extends GatewayError {
  constructor(serverId: string, cause: string) {
    super(`Proxy call to ${serverId} failed: ${cause}`, "PROXY_ERROR");
  }
}
