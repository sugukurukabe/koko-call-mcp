import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AwardMappingResultSchema } from "../domain/investor.js";
import { VERSION } from "../lib/version.js";
import {
  type InvestorWorkspaceViewModel,
  isAllowedOfficialLink,
  sparklinePath,
  toInvestorWorkspaceViewModel,
} from "./investor-radar-view-model.js";
import "./investor-radar.css";

interface ToolResultLike {
  structuredContent?: unknown;
}

function WelcomeScreen() {
  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <h2 className="welcome-title">Investor Radar</h2>
        <p className="welcome-desc">
          官公需公告を上場企業の銘柄コードへ名寄せします。売買の推奨は行いません。
        </p>
        <p className="welcome-hint">
          検索バーに企業名・キーワードを入れるか、チャットで <code>search_investor_radar_app</code>{" "}
          を指示してください。
        </p>
      </div>
    </div>
  );
}

function App() {
  const [workspace, setWorkspace] = useState<InvestorWorkspaceViewModel | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<string | null>(null);
  const [availableDisplayModes, setAvailableDisplayModes] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const applyResult = (structuredContent: unknown) => {
    const parsed = AwardMappingResultSchema.safeParse(structuredContent);
    if (!parsed.success) {
      setError("Tool result did not include Investor Radar structured content.");
      return;
    }
    const next = toInvestorWorkspaceViewModel(parsed.data);
    setWorkspace(next);
    setSelectedKey(next.cards[0]?.key ?? null);
    setError(null);
    setIsSearching(false);
  };

  const {
    app,
    isConnected,
    error: appError,
  } = useApp({
    appInfo: {
      name: "jp-bids-investor-radar",
      title: "Investor Radar",
      version: VERSION,
      description: "Map KKJ notices to listed-company tickers. Not investment advice.",
    },
    capabilities: { availableDisplayModes: ["inline", "fullscreen"] },
    strict: true,
    onAppCreated: (created) => {
      created.onteardown = async () => ({});
      created.addEventListener("toolinput", () => {
        setIsSearching(true);
        setError(null);
      });
      created.addEventListener("toolresult", (toolResult: ToolResultLike) => {
        applyResult(toolResult.structuredContent);
      });
      created.addEventListener("toolcancelled", () => {
        setIsSearching(false);
      });
      created.addEventListener("hostcontextchanged", (context) => {
        const currentContext = created.getHostContext() ?? context;
        setDisplayMode(currentContext.displayMode ?? null);
        setAvailableDisplayModes(currentContext.availableDisplayModes ?? []);
      });
    },
  });

  const selected = workspace?.cards.find((card) => card.key === selectedKey);

  return (
    <div className="workspace">
      <header className="ws-header">
        <strong>Investor Radar</strong>
        <form
          className="ws-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            void handleInAppSearch(app, searchInput.trim(), applyResult, setIsSearching, setError);
          }}
        >
          <input
            className="ws-search-input"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="企業名・キーワード…"
            disabled={isSearching || !isConnected}
          />
          <button
            type="submit"
            className="ws-search-btn"
            disabled={isSearching || !searchInput.trim()}
          >
            {isSearching ? "…" : "検索"}
          </button>
        </form>
        <div className="ws-header-right">
          {availableDisplayModes.includes("fullscreen") && (
            <button
              className="btn-icon"
              type="button"
              onClick={() =>
                void handleToggleDisplayMode(app, displayMode, setDisplayMode, setActionMessage)
              }
            >
              {displayMode === "fullscreen" ? "↙" : "↗"}
            </button>
          )}
          <span className="status-dot">{isConnected ? "●" : "○"}</span>
        </div>
      </header>
      {(error || appError) && <div className="notice error">{error ?? String(appError)}</div>}
      {actionMessage && <div className="notice compact">{actionMessage}</div>}
      {workspace && <div className="disclaimer">{workspace.disclaimer}</div>}
      {!workspace ? (
        !isSearching && <WelcomeScreen />
      ) : (
        <div className={`ws-body${isSearching ? " ws-body--loading" : ""}`}>
          <aside className="priority-lane">
            <div className="lane-header">
              <span>名寄せ {workspace.mappedCount}</span>
              <span className="lane-count">未一致 {workspace.unmappedCount}</span>
            </div>
            <div className="lane-cards">
              {workspace.cards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  className={`bid-card ${card.key === selectedKey ? "selected" : ""}`}
                  onClick={() => setSelectedKey(card.key)}
                >
                  <div className="card-priority">
                    <span className="ticker">{card.ticker}</span>
                    <span className="sector">{card.sector}</span>
                  </div>
                  <div className="card-project">{card.projectName}</div>
                  <div className="card-meta">
                    {card.companyName} / {card.noticeDate}
                  </div>
                </button>
              ))}
            </div>
          </aside>
          <section className="workbench">
            {selected ? (
              <>
                <h2>{selected.projectName}</h2>
                <p>
                  {selected.companyName} ({selected.ticker}) / {selected.organizationName} /{" "}
                  {selected.prefectureName}
                </p>
                <svg className="sparkline" viewBox="0 0 240 64" aria-hidden="true">
                  <path
                    d={sparklinePath([
                      { date: "t0", close: 100 },
                      { date: "t1", close: 100 },
                    ])}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
                <p className="hint">
                  価格線は analyze_award_price_impact の結果があるときのみ意味を持ちます。
                </p>
                <div className="action-dock">
                  <button
                    type="button"
                    onClick={() =>
                      void sendChatAction(
                        app,
                        `この案件 ${selected.key}（${selected.ticker} ${selected.companyName}）の公告履歴を get_listed_award_history で出して。投資助言は不要です。`,
                        "履歴",
                        setActionMessage,
                      )
                    }
                  >
                    履歴
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void sendChatAction(
                        app,
                        `analyze_award_price_impact で ${selected.ticker} の公告日前後の終値系列だけを出して。買い推奨はしないでください。bid_key=${selected.key}`,
                        "終値",
                        setActionMessage,
                      )
                    }
                  >
                    終値
                  </button>
                  {isAllowedOfficialLink(selected.officialUrl) && (
                    <button
                      type="button"
                      onClick={() => void openOfficial(app, selected.officialUrl, setActionMessage)}
                    >
                      公式
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p>名寄せできた公告がありません。企業名をクエリに含めて再検索してください。</p>
            )}
            <details className="evidence-panel">
              <summary>出典 / Evidence</summary>
              <p>出典: {workspace.dataSource}</p>
              <p>取得: {workspace.accessedAt}</p>
              <p>カタログ: {workspace.catalogSource}</p>
            </details>
          </section>
        </div>
      )}
    </div>
  );
}

async function handleInAppSearch(
  app: ReturnType<typeof useApp>["app"],
  query: string,
  applyResult: (value: unknown) => void,
  setIsSearching: (value: boolean) => void,
  setError: (value: string | null) => void,
): Promise<void> {
  if (!app || !query) {
    return;
  }
  setIsSearching(true);
  try {
    const result = await app.callServerTool({
      name: "search_investor_radar_app",
      arguments: { query, limit: 20 },
    });
    if (result.isError) {
      setError("検索でエラーが返されました。条件を変えて再試行してください。");
      setIsSearching(false);
      return;
    }
    applyResult(result.structuredContent);
  } catch {
    setError("再検索に失敗しました。チャットから search_investor_radar_app を実行してください。");
    setIsSearching(false);
  }
}

async function sendChatAction(
  app: ReturnType<typeof useApp>["app"],
  promptText: string,
  actionLabel: string,
  setActionMessage: (value: string) => void,
): Promise<void> {
  if (app?.getHostCapabilities()?.message?.text) {
    try {
      const result = await app.sendMessage({
        role: "user",
        content: [{ type: "text", text: promptText }],
      });
      if (!result.isError) {
        setActionMessage(`${actionLabel}リクエストをchatへ送信しました。`);
        return;
      }
    } catch {
      // clipboard fallback
    }
  }
  try {
    await navigator.clipboard.writeText(promptText);
    setActionMessage("ホストが拒否したため、依頼文をクリップボードへコピーしました。");
  } catch {
    setActionMessage(`チャットで「${actionLabel}」と入力してください。`);
  }
}

async function openOfficial(
  app: ReturnType<typeof useApp>["app"],
  url: string,
  setActionMessage: (value: string) => void,
): Promise<void> {
  if (!isAllowedOfficialLink(url)) {
    setActionMessage("許可されていないURLです。");
    return;
  }
  try {
    const result = await app?.openLink({ url });
    if (result && "isError" in result && result.isError) {
      await navigator.clipboard.writeText(url);
      setActionMessage("公式URLをコピーしました。");
    }
  } catch {
    try {
      await navigator.clipboard.writeText(url);
      setActionMessage("公式URLをコピーしました。");
    } catch {
      setActionMessage(url);
    }
  }
}

async function handleToggleDisplayMode(
  app: ReturnType<typeof useApp>["app"],
  displayMode: string | null,
  setDisplayMode: (value: string) => void,
  setActionMessage: (value: string) => void,
): Promise<void> {
  const next = displayMode === "fullscreen" ? "inline" : "fullscreen";
  try {
    const result = await app?.requestDisplayMode({ mode: next });
    if (result?.mode) {
      setDisplayMode(result.mode);
    }
  } catch {
    setActionMessage("表示モードを切り替えられませんでした。");
  }
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}
