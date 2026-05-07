// Prompts / Resources の登録・呼び出しテスト
// Tests for Prompts / Resources registration and invocation
// Tes untuk registrasi dan pemanggilan Prompts / Resources

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { registerPrompts } from "../../src/prompts/register-prompts.js";
import { registerResources } from "../../src/resources/register-resources.js";

function createTestServer(): McpServer {
  return new McpServer(
    { name: "test", version: "0.0.0" },
    {
      capabilities: {
        tools: { listChanged: false },
        prompts: { listChanged: false },
        resources: { listChanged: false },
      },
    },
  );
}

type InternalServer = {
  _registeredPrompts: Record<string, unknown>;
  _registeredResources: Record<string, unknown>;
};

describe("registerPrompts", () => {
  it("5 個の Prompt が登録される / registers 5 prompts", () => {
    const server = createTestServer();
    registerPrompts(server);

    const registered = (server as unknown as InternalServer)._registeredPrompts;
    const keys = Object.keys(registered);
    expect(keys).toHaveLength(5);
    expect(keys).toEqual(
      expect.arrayContaining([
        "investigate_opportunity",
        "financial_health_check",
        "bid_to_close_workflow",
        "cross_mcp_comparison",
        "gateway_quick_tour",
      ]),
    );
  });
});

describe("registerResources", () => {
  it("4 個の Resource が登録される / registers 4 resources", () => {
    const server = createTestServer();
    registerResources(server);

    const registered = (server as unknown as InternalServer)._registeredResources;
    const keys = Object.keys(registered);
    expect(keys).toHaveLength(4);
    expect(keys).toEqual(
      expect.arrayContaining([
        "gateway://registry/summary",
        "gateway://modes/reference",
        "gateway://samples/queries",
        "gateway://attribution/all",
      ]),
    );
  });
});
