import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  applyHostTheme as applyInvestorHostTheme,
  ErrorBoundary as InvestorErrorBoundary,
} from "../../src/apps/investor-radar.js";
import {
  EXAMPLE_PROMPTS,
  handleSelectExamplePrompt,
  resolveExampleSearchQuery,
  WelcomeScreen,
} from "../../src/apps/search-results.js";

type ExampleApp = Parameters<typeof handleSelectExamplePrompt>[0];

describe("MCP Apps v0.10.0 UI Onboarding & Parity Verification", () => {
  it("declares lang='ja' in both ui/search-results.html and ui/investor-radar.html", async () => {
    const searchHtml = await readFile("ui/search-results.html", "utf8");
    const investorHtml = await readFile("ui/investor-radar.html", "utf8");

    expect(searchHtml).toContain('<html lang="ja">');
    expect(searchHtml).not.toContain('<html lang="en">');
    expect(investorHtml).toContain('<html lang="ja">');
  });

  it("renders interactive button chips for all EXAMPLE_PROMPTS in WelcomeScreen and respects disabled prop", () => {
    const htmlEnabled = renderToStaticMarkup(createElement(WelcomeScreen, { disabled: false }));
    expect(htmlEnabled).toContain('class="example-chip"');
    for (const prompt of EXAMPLE_PROMPTS) {
      expect(htmlEnabled).toContain(prompt);
    }
    const buttonMatches = htmlEnabled.match(/<button[^>]*class="example-chip"[^>]*>/g) ?? [];
    expect(buttonMatches).toHaveLength(EXAMPLE_PROMPTS.length);
    for (const match of buttonMatches) {
      expect(match).toContain('type="button"');
      expect(match).not.toContain("disabled");
    }

    const htmlDisabled = renderToStaticMarkup(createElement(WelcomeScreen, { disabled: true }));
    const disabledMatches = htmlDisabled.match(/<button[^>]*class="example-chip"[^>]*>/g) ?? [];
    expect(disabledMatches).toHaveLength(EXAMPLE_PROMPTS.length);
    for (const match of disabledMatches) {
      expect(match).toContain("disabled");
    }
  });

  it("resolves structured criteria and triggers in-app search when clicking an example chip", async () => {
    const resolved = resolveExampleSearchQuery(EXAMPLE_PROMPTS[0]);
    expect(resolved).toEqual({
      query: "システム",
      criteria: { prefecture: "鹿児島県", category: "役務" },
    });

    let searchInputValue = "";
    let calledTool = "";
    let calledArgs: Record<string, unknown> = {};

    const mockApp = {
      getHostCapabilities: () => ({ serverTools: true }),
      callServerTool: vi.fn(async ({ name, arguments: args }) => {
        calledTool = name;
        calledArgs = args;
        return {
          isError: false,
          structuredContent: {
            searchHits: 0,
            returnedCount: 0,
            bids: [],
            query: {},
            attribution: {
              dataSource: "中小企業庁 官公需情報ポータルサイト",
              apiEndpoint: "http://www.kkj.go.jp/api/",
              licenseUrl: "https://www.kkj.go.jp/s/help/notes/",
              serviceDisclaimer: "disclaimer",
              accessedAt: "2026-11-16T00:00:00.000Z",
            },
          },
        };
      }),
    };

    await handleSelectExamplePrompt(
      mockApp as unknown as ExampleApp,
      EXAMPLE_PROMPTS[0],
      (val) => {
        searchInputValue = val;
      },
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    );

    expect(searchInputValue).toBe("システム");
    expect(calledTool).toBe("search_bids_app");
    expect(calledArgs).toEqual({
      query: "システム",
      limit: 20,
      prefecture: "鹿児島県",
      category: "役務",
    });
  });

  it("falls back to sendMessage and clipboard when serverTools is unavailable on example chip click", async () => {
    let sentText = "";
    let actionMessage = "";

    const messageOnlyApp = {
      getHostCapabilities: () => ({ message: { text: {} } }),
      sendMessage: vi.fn(async (payload: { content: Array<{ text: string }> }) => {
        sentText = payload.content[0]?.text ?? "";
        return { isError: false };
      }),
    };

    await handleSelectExamplePrompt(
      messageOnlyApp as unknown as ExampleApp,
      EXAMPLE_PROMPTS[1],
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      (msg) => {
        actionMessage = msg;
      },
    );

    expect(sentText).toBe(EXAMPLE_PROMPTS[1]);
    expect(actionMessage).toBe("入力例をchatへ送信しました。");

    const originalClipboard = globalThis.navigator?.clipboard;
    let copiedText = "";
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: {
        writeText: vi.fn(async (text: string) => {
          copiedText = text;
        }),
      },
      configurable: true,
    });

    try {
      const restrictedApp = {
        getHostCapabilities: () => ({}),
      };
      await handleSelectExamplePrompt(
        restrictedApp as unknown as ExampleApp,
        EXAMPLE_PROMPTS[2],
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        (msg) => {
          actionMessage = msg;
        },
      );
      expect(copiedText).toBe(EXAMPLE_PROMPTS[2]);
      expect(actionMessage).toContain("プロンプトをコピーしました");
    } finally {
      Object.defineProperty(globalThis.navigator, "clipboard", {
        value: originalClipboard,
        configurable: true,
      });
    }
  });

  it("supports host theme overrides and ErrorBoundary recovery in investor-radar", async () => {
    const investorCss = await readFile("src/apps/investor-radar.css", "utf8");
    expect(investorCss).toContain(':root[data-theme="dark"]');
    expect(investorCss).toContain(':root[data-theme="light"]');

    const originalDoc = globalThis.document;
    const mockDoc = {
      documentElement: {
        dataset: {} as Record<string, string | undefined>,
      },
    };
    Object.defineProperty(globalThis, "document", {
      value: mockDoc,
      configurable: true,
    });

    try {
      applyInvestorHostTheme("dark");
      expect(mockDoc.documentElement.dataset.theme).toBe("dark");

      applyInvestorHostTheme("light");
      expect(mockDoc.documentElement.dataset.theme).toBe("light");

      applyInvestorHostTheme(undefined);
      expect(mockDoc.documentElement.dataset.theme).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, "document", {
        value: originalDoc,
        configurable: true,
      });
    }

    const derived = InvestorErrorBoundary.getDerivedStateFromError(
      new Error("Simulated render crash"),
    );
    expect(derived).toEqual({
      hasError: true,
      errorMessage: "Simulated render crash",
    });

    let resetCalled = false;
    const boundary = new InvestorErrorBoundary({
      children: createElement("div", null, "ok"),
      onReset: () => {
        resetCalled = true;
      },
    });
    boundary.state = derived;
    const fallbackHtml = renderToStaticMarkup(
      boundary.render() as ReturnType<typeof createElement>,
    );
    expect(fallbackHtml).toContain("Investor Radar 初期化エラー");
    expect(fallbackHtml).toContain("Simulated render crash");

    let nextState: unknown = null;
    boundary.setState = ((state: unknown) => {
      nextState = state;
    }) as typeof boundary.setState;
    boundary.handleReset();
    expect(nextState).toEqual({ hasError: false, errorMessage: null });
    expect(resetCalled).toBe(true);
  });
});
