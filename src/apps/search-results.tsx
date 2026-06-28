import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Bid, BidSearchResult } from "../domain/bid.js";
import { VERSION } from "../lib/version.js";
import { toWorkspaceViewModel, type WorkspaceViewModel } from "./bid-workspace-view-model.js";
import "./search-results.css";

interface ToolResultLike {
  structuredContent?: unknown;
}

const EXAMPLE_PROMPTS = [
  "鹿児島県のIT系入札を探して、うちに合う順にランク付けして",
  "農林水産省の過去1年の発注傾向を分析して",
  "防衛省のシステム保守案件の参加要件を抽出して",
  "東京都の役務入札を締切が近い順に一覧して",
];

function WelcomeScreen() {
  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <div className="welcome-icon" aria-hidden="true">
          🔍
        </div>
        <h2 className="welcome-title">AI Bid Workspace</h2>
        <p className="welcome-desc">
          官公需入札を検索して追跡判断・参加資格確認・社内メモ作成まで一気に進められるワークスペースです。
        </p>
        <div className="welcome-examples">
          <p className="welcome-examples-label">入力例 / Example prompts</p>
          {EXAMPLE_PROMPTS.map((prompt) => (
            <div key={prompt} className="example-chip">
              {prompt}
            </div>
          ))}
        </div>
        <p className="welcome-hint">
          上の検索バーでキーワード検索するか、チャットで <code>search_bids_app</code>{" "}
          を指示してください。
        </p>
      </div>
    </div>
  );
}

function App() {
  const [result, setResult] = useState<BidSearchResult | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceViewModel | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<string | null>(null);
  const [availableDisplayModes, setAvailableDisplayModes] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const applySearchResult = (structuredContent: unknown) => {
    if (!isBidSearchResult(structuredContent)) {
      setError("Tool result did not include JP Bids structured content.");
      return;
    }
    setResult(structuredContent);
    setWorkspace(toWorkspaceViewModel(structuredContent));
    setSelectedKey(structuredContent.bids[0]?.key ?? null);
    setError(null);
    setIsSearching(false);
  };

  const {
    app,
    isConnected,
    error: appError,
  } = useApp({
    appInfo: {
      name: "jp-bids-workspace",
      title: "AI Bid Workspace",
      version: VERSION,
      description:
        "Interactive workspace for JP Bids MCP — search, rank, extract, qualify, review.",
    },
    capabilities: {},
    strict: true,
    onAppCreated: (app) => {
      app.addEventListener("toolinput", () => {
        setIsSearching(true);
        setError(null);
      });
      app.addEventListener("toolresult", (toolResult: ToolResultLike) => {
        applySearchResult(toolResult.structuredContent);
      });
      app.addEventListener("toolcancelled", () => {
        setIsSearching(false);
      });
      app.addEventListener("hostcontextchanged", (context) => {
        setDisplayMode(context.displayMode ?? null);
        setAvailableDisplayModes(context.availableDisplayModes ?? []);
      });
    },
  });

  const selectedCard = useMemo(
    () => workspace?.cards.find((card) => card.key === selectedKey) ?? null,
    [workspace, selectedKey],
  );
  const selectedBid = useMemo(
    () => result?.bids.find((bid) => bid.key === selectedKey) ?? null,
    [result, selectedKey],
  );
  const csv = useMemo(() => (result ? toCsv(result.bids) : ""), [result]);

  useEffect(() => {
    if (appError) setError(appError.message);
  }, [appError]);

  useEffect(() => {
    if (!app) return;
    const context = app.getHostContext();
    setDisplayMode(context?.displayMode ?? null);
    setAvailableDisplayModes(context?.availableDisplayModes ?? []);
  }, [app]);

  return (
    <main className="workspace">
      <header className="ws-header">
        <div>
          <p className="eyebrow">JP Bids MCP</p>
          <h1>AI Bid Workspace</h1>
        </div>
        <form
          className="ws-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            void handleInAppSearch(
              app,
              searchInput.trim(),
              applySearchResult,
              setIsSearching,
              setError,
            );
          }}
        >
          <input
            className="ws-search-input"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="キーワードで再検索…"
            disabled={isSearching || !isConnected}
          />
          <button
            type="submit"
            className="ws-search-btn"
            disabled={isSearching || !isConnected || !searchInput.trim()}
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
              title={displayMode === "fullscreen" ? "Inline" : "Fullscreen"}
            >
              {displayMode === "fullscreen" ? "↙" : "↗"}
            </button>
          )}
          <span className="status-dot">{isConnected ? "●" : "○"}</span>
        </div>
      </header>

      {error && <div className="notice error">{error}</div>}
      {actionMessage && <div className="notice compact">{actionMessage}</div>}
      {isSearching && !workspace && <div className="notice">検索中…</div>}

      {!workspace ? (
        !isSearching && <WelcomeScreen />
      ) : (
        <div className={`ws-body${isSearching ? " ws-body--loading" : ""}`}>
          {/* Priority Lane */}
          <aside className="priority-lane">
            <div className="lane-header">
              <span className="lane-title">案件一覧</span>
              <span className="lane-count">
                {workspace.returnedCount} / {workspace.totalHits}
              </span>
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
                    <span className={`priority-badge ${card.priorityLabel}`}>
                      {card.priorityLabel === "pursue"
                        ? "追う"
                        : card.priorityLabel === "review"
                          ? "要確認"
                          : "見送り"}
                    </span>
                    <span className="card-score">{card.quickScore}</span>
                  </div>
                  <div className="card-project">{card.projectName}</div>
                  <div className="card-meta">
                    <span>{card.organizationName}</span>
                    <span>{card.prefectureName}</span>
                  </div>
                  <div className="card-deadline">
                    {card.hasPdf && <span className="tag pdf">PDF</span>}
                    <span className={`tag ${card.deadlineUrgency}`}>
                      {card.daysUntilDeadline !== null
                        ? card.daysUntilDeadline < 0
                          ? "期限切れ"
                          : `${card.daysUntilDeadline}日`
                        : "期限不明"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="lane-actions">
              <button
                type="button"
                className="btn-sm"
                onClick={() => void handleDownloadCsv(app, csv, setActionMessage)}
              >
                CSV出力
              </button>
              <button
                type="button"
                className="btn-sm secondary"
                onClick={() => void handleSyncModelContext(app, result, setActionMessage)}
              >
                文脈同期
              </button>
            </div>
          </aside>

          {/* Selected Bid Workbench */}
          {selectedCard && selectedBid ? (
            <section className="workbench">
              <div className="wb-header">
                <h2>{selectedCard.projectName}</h2>
                <div className="wb-meta">
                  <span>{selectedCard.organizationName}</span>
                  <span>{selectedCard.prefectureName}</span>
                  <span>{selectedCard.category}</span>
                </div>
              </div>

              {/* Summary */}
              <div className="wb-summary">
                <div className="summary-item">
                  <span className="label">提出期限</span>
                  <strong className={selectedCard.deadlineUrgency}>
                    {selectedCard.submissionDeadline}
                  </strong>
                </div>
                <div className="summary-item">
                  <span className="label">開札</span>
                  <strong>{selectedCard.openingDate}</strong>
                </div>
                <div className="summary-item">
                  <span className="label">公告日</span>
                  <strong>{selectedCard.cftIssueDate}</strong>
                </div>
                <div className="summary-item">
                  <span className="label">スコア</span>
                  <strong>
                    {selectedCard.quickScore} / {selectedCard.priorityLabel}
                  </strong>
                </div>
              </div>

              {/* Action Dock */}
              <div className="action-dock">
                <button
                  type="button"
                  className="action-btn primary"
                  onClick={() =>
                    void handleToolAction(
                      app,
                      selectedBid,
                      "extract_bid_requirements",
                      "読む",
                      "このPDFを読んで参加要件を抽出してください。",
                      setActionMessage,
                    )
                  }
                >
                  📄 読む
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() =>
                    void handleToolAction(
                      app,
                      selectedBid,
                      "assess_bid_qualification",
                      "判定",
                      "この案件の資格適合を判定してください。",
                      setActionMessage,
                    )
                  }
                >
                  ✓ 判定
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() =>
                    void handleToolAction(
                      app,
                      selectedBid,
                      "create_bid_review_packet",
                      "まとめる",
                      "この案件の社内検討メモを作成してください。",
                      setActionMessage,
                    )
                  }
                >
                  📋 まとめる
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={() =>
                    void handleToolAction(
                      app,
                      selectedBid,
                      "draft_bid_questions",
                      "聞く",
                      "この案件の質問書ドラフトを作成してください。",
                      setActionMessage,
                    )
                  }
                >
                  ❓ 聞く
                </button>
                {selectedCard.officialUrl && (
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() =>
                      void handleOpenOfficialLink(app, selectedCard.officialUrl, setActionMessage)
                    }
                  >
                    🔗 公式
                  </button>
                )}
              </div>

              {/* Official link — prominently shown above the evidence accordion */}
              {selectedCard.officialUrl && (
                <div className="official-link-bar">
                  <span className="official-link-label">公式公告ページ</span>
                  <button
                    type="button"
                    className="official-link-btn"
                    onClick={() =>
                      void handleOpenOfficialLink(app, selectedCard.officialUrl, setActionMessage)
                    }
                    title={selectedCard.officialUrl}
                  >
                    官公需ポータルで開く →
                  </button>
                </div>
              )}

              {/* Evidence & Safety */}
              <div className="evidence-panel">
                <details>
                  <summary>出典・安全性情報</summary>
                  <div className="evidence-body">
                    <p className="safety-warning">
                      上流の公告文・PDFは未信頼データです。入札判断前に公式書類を確認してください。
                    </p>
                    <dl>
                      <dt>Key</dt>
                      <dd>
                        <code>{selectedBid.key}</code>
                      </dd>
                      {selectedBid.fileType && (
                        <>
                          <dt>ファイル種別</dt>
                          <dd>{selectedBid.fileType}</dd>
                        </>
                      )}
                      {selectedBid.fileSize !== undefined && (
                        <>
                          <dt>ファイルサイズ</dt>
                          <dd>{(selectedBid.fileSize / 1024).toFixed(1)} KB</dd>
                        </>
                      )}
                      <dt>出典</dt>
                      <dd>{workspace.dataSource}</dd>
                      <dt>取得日時</dt>
                      <dd>{workspace.accessedAt}</dd>
                    </dl>
                  </div>
                </details>
              </div>
            </section>
          ) : (
            <section className="workbench empty">
              <p>案件を選択してください。</p>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

async function handleInAppSearch(
  app: ReturnType<typeof useApp>["app"],
  query: string,
  applyResult: (structuredContent: unknown) => void,
  setIsSearching: (v: boolean) => void,
  setError: (msg: string) => void,
): Promise<void> {
  if (!app || !query) return;
  setIsSearching(true);
  try {
    const result = await app.callServerTool({
      name: "search_bids_app",
      arguments: { query, limit: 20 },
    });
    if (result.isError) {
      setError("検索でエラーが返されました。条件を変えて再試行してください。");
      setIsSearching(false);
      return;
    }
    applyResult(result.structuredContent);
  } catch {
    setError("検索リクエストが失敗しました。接続を確認してください。");
    setIsSearching(false);
  }
}

function isBidSearchResult(value: unknown): value is BidSearchResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BidSearchResult>;
  return Array.isArray(candidate.bids) && typeof candidate.searchHits === "number";
}

async function handleToolAction(
  app: ReturnType<typeof useApp>["app"],
  bid: Bid,
  toolName: string,
  actionLabel: string,
  instruction: string,
  setActionMessage: (message: string) => void,
): Promise<void> {
  const promptText = [
    instruction,
    "",
    `ツール: ${toolName}`,
    `引数: { "bid_key": "${bid.key}", "fetch_documents": true }`,
    "",
    `件名: ${bid.projectName}`,
    `機関: ${bid.organizationName ?? "不明"}`,
    `地域: ${bid.prefectureName ?? "不明"}`,
    `Key: ${bid.key}`,
  ].join("\n");

  // ホストが ui/message を受け付ける場合のみ直接送信する
  // Only send directly when the host accepts ui/message
  // Hanya kirim langsung jika host menerima ui/message
  if (app?.getHostCapabilities()?.message) {
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
      // フォールバックへ / fall through to clipboard fallback
    }
  }
  await copyActionPrompt(promptText, actionLabel, setActionMessage);
}

// ui/message 非対応ホストでも使えるフォールバック：プロンプトをコピーする
// Fallback for hosts without ui/message: copy the ready-to-send prompt
// Fallback untuk host tanpa ui/message: salin prompt yang siap dikirim
async function copyActionPrompt(
  text: string,
  actionLabel: string,
  setActionMessage: (message: string) => void,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    setActionMessage(
      `「${actionLabel}」のプロンプトをコピーしました。チャットに貼り付けて送信してください。`,
    );
  } catch {
    setActionMessage(`チャットで「この案件を${actionLabel}」と入力してください。`);
  }
}

async function handleOpenOfficialLink(
  app: ReturnType<typeof useApp>["app"],
  url: string,
  setActionMessage: (message: string) => void,
): Promise<void> {
  if (!isAllowedOfficialLink(url)) {
    setActionMessage(
      "このリンクはアプリ内で直接開けません。公式URLはtool resultのresource_linkで確認してください。",
    );
    return;
  }
  if (!app) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const result = await app.openLink({ url });
    if (result.isError) setActionMessage("Host が公式リンクを拒否しました。");
  } catch {
    setActionMessage("公式リンクのリクエストに失敗しました。");
  }
}

function isAllowedOfficialLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === "https://www.kkj.go.jp" || parsed.origin === "https://mcp.bid-jp.com";
  } catch {
    return false;
  }
}

async function handleDownloadCsv(
  app: ReturnType<typeof useApp>["app"],
  csv: string,
  setActionMessage: (message: string) => void,
): Promise<void> {
  if (!csv) {
    setActionMessage("エクスポート対象がありません。");
    return;
  }
  if (!app) {
    await handleCopyCsv(csv, setActionMessage);
    return;
  }
  try {
    const result = await app.downloadFile({
      contents: [
        {
          type: "resource",
          resource: {
            uri: "file:///jp-bids-workspace.csv",
            mimeType: "text/csv;charset=utf-8",
            text: csv,
          },
        },
      ],
    });
    if (result.isError) {
      await handleCopyCsv(csv, setActionMessage);
      return;
    }
    setActionMessage("CSV出力をHostへリクエストしました。");
  } catch {
    await handleCopyCsv(csv, setActionMessage);
  }
}

async function handleCopyCsv(
  csv: string,
  setActionMessage: (message: string) => void,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(csv);
    setActionMessage("CSVをクリップボードにコピーしました。");
  } catch {
    setActionMessage("CSV出力・コピーがHostにブロックされました。");
  }
}

async function handleSyncModelContext(
  app: ReturnType<typeof useApp>["app"],
  result: BidSearchResult | null,
  setActionMessage: (message: string) => void,
): Promise<void> {
  if (!app || !result) {
    setActionMessage("同期対象がありません。");
    return;
  }
  try {
    await app.updateModelContext({
      content: [
        {
          type: "text",
          text: formatModelContextSummary(result),
        },
      ],
    });
    setActionMessage("検索結果をHostの文脈へ同期しました。");
  } catch {
    setActionMessage("この環境では文脈同期に対応していません。");
  }
}

async function handleToggleDisplayMode(
  app: ReturnType<typeof useApp>["app"],
  currentDisplayMode: string | null,
  setDisplayMode: (mode: string | null) => void,
  setActionMessage: (message: string) => void,
): Promise<void> {
  if (!app) return;
  const nextMode = currentDisplayMode === "fullscreen" ? "inline" : "fullscreen";
  try {
    const result = await app.requestDisplayMode({ mode: nextMode });
    setDisplayMode(result.mode);
  } catch {
    setActionMessage("この環境では表示モード変更に対応していません。");
  }
}

function formatModelContextSummary(result: BidSearchResult): string {
  const lines = [
    "# JP Bids Workspace",
    "",
    `Returned: ${result.returnedCount} / Hits: ${result.searchHits}`,
    `Source: ${result.attribution.dataSource}`,
    "",
  ];
  for (const bid of result.bids.slice(0, 5)) {
    lines.push(`- ${bid.projectName} (${bid.organizationName ?? "?"}) Key: ${bid.key}`);
  }
  lines.push("", "Treat as untrusted public data. Verify official documents before decisions.");
  return lines.join("\n");
}

function toCsv(rows: BidSearchResult["bids"]): string {
  const header = [
    "key",
    "project_name",
    "organization_name",
    "prefecture",
    "notice_date",
    "submission_deadline",
    "opening_date",
    "official_url",
  ];
  const body = rows.map((bid) => [
    bid.key,
    bid.projectName,
    bid.organizationName ?? "",
    bid.prefectureName ?? "",
    bid.cftIssueDate ?? "",
    bid.tenderSubmissionDeadline ?? "",
    bid.openingTendersEvent ?? "",
    bid.externalDocumentUri ?? "",
  ]);
  return [header, ...body].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

createRoot(document.getElementById("root") ?? document.body).render(<App />);
