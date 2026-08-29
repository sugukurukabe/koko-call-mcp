import { describe, expect, it } from "vitest";
import type { DailyBar } from "../../src/api/jquants-client.js";
import {
  computePctChange,
  JquantsClient,
  lastCloseOnOrBefore,
  shiftIsoDate,
} from "../../src/api/jquants-client.js";

const bars: DailyBar[] = [
  {
    date: "2026-04-08",
    code: "67020",
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1,
    adjustmentClose: 100,
  },
  {
    date: "2026-04-10",
    code: "67020",
    open: 110,
    high: 111,
    low: 109,
    close: 110,
    volume: 1,
    adjustmentClose: 110,
  },
];

describe("jquants helpers", () => {
  it("shifts ISO dates and computes window closes", () => {
    expect(shiftIsoDate("2026-04-10", -5)).toBe("2026-04-05");
    expect(lastCloseOnOrBefore(bars, "2026-04-09")).toBe(100);
    expect(lastCloseOnOrBefore(bars, "2026-04-10")).toBe(110);
    expect(computePctChange(100, 110)).toBe(10);
    expect(computePctChange(0, 10)).toBeNull();
  });
});

describe("JquantsClient", () => {
  it("namespaces cache by hashed key and never ships raw secrets in requests after auth", async () => {
    const calls: string[] = [];
    const client = new JquantsClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url.endsWith("/token/auth_refresh")) {
          const body = JSON.parse(String(init?.body));
          expect(body.refreshtoken).toBe("user-secret-key");
          return new Response(JSON.stringify({ idToken: "id-token" }), { status: 200 });
        }
        if (url.includes("/equities/bars/daily")) {
          expect(init?.headers).toMatchObject({ Authorization: "Bearer id-token" });
          return new Response(
            JSON.stringify({
              data: [
                {
                  Date: "2026-04-10",
                  Code: "67020",
                  Close: 2500,
                  AdjustmentClose: 2500,
                },
              ],
            }),
            { status: 200 },
          );
        }
        throw new Error(`unexpected ${url}`);
      },
    });

    const first = await client.dailyBars("user-secret-key", "6702", "2026-04-01", "2026-04-30");
    const second = await client.dailyBars("user-secret-key", "6702", "2026-04-01", "2026-04-30");
    expect(first[0]?.close).toBe(2500);
    expect(second).toEqual(first);
    expect(calls.filter((call) => call.includes("/equities/bars/daily"))).toHaveLength(1);
  });

  it("maps 401 to a user-correctable key error", async () => {
    const client = new JquantsClient({
      rateLimitPerSecond: 1000,
      fetchImpl: async () => new Response("unauthorized", { status: 401 }),
    });
    await expect(client.listedMaster("bad-key")).rejects.toThrow(/J-Quants APIキーが無効/);
  });
});
