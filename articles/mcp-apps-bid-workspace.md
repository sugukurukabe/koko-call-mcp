---
title: "会話の中に画面を置く — MCP Apps で入札ワークスペースを実装する"
emoji: "🪟"
type: "tech"
topics: ["mcp", "typescript", "react", "claude", "ai"]
published: false
---

## 画面の不在 — 入札調査の朝に起きていること

入札調査の朝に最初に開かれるのは、AIではなくブラウザのタブです。中小企業庁の官公需情報ポータルサイト（KKJ）で県名と業種を選び、検索結果の一覧から気になる件名をクリックし、仕様書PDFをダウンロードし、提出期限をExcelの行に転記し、開札日を手帳に書き写す。ここには年間180万件以上の公告が流れています（出典: 中小企業庁 官公需情報ポータルサイト 統計情報, 2024年度）。

この作業をAIに任せると、ひとつだけ困ることが起きます。会話は速いのに、**一覧が残らない**のです。「鹿児島県のIT系入札を探して」と頼めば結果は返ってきます。しかし14件のうちどれを選んだのか、どれをまだ読んでいないのか、どれが2日後に締め切られるのかは、チャットの履歴を上にスクロールしながら思い出すことになります。会話は流れる媒体で、判断材料は留まる必要があります。

MCP Apps は、この「留まる場所」を会話の中に置くための拡張です。この記事は、JP Bids MCP に実装した AI Bid Workspace という画面が、どういう制約の下で、どこで実機に殴られながら書かれたかの記録です。

![AI Bid Workspace の全景。左に案件一覧、右に選択案件の詳細とAction Dock](/images/mcp-apps-bid-workspace/02-workspace.png)

## MCP Apps の定義 — 会話の中に置かれる iframe

MCP Apps（Model Context Protocol Apps）は、MCPサーバーが `ui://` スキームのリソースとしてHTMLを返し、ホストがそれを iframe で描画し、`postMessage` 上の JSON-RPC でアプリとホストが会話する拡張仕様です。ツールの結果がテキストではなく画面として返る、という一点だけが新しく、それ以外はすべて既存のMCPの語彙で説明できます。

実装は `@modelcontextprotocol/ext-apps` 1.7.4 と `@modelcontextprotocol/sdk` 1.29.0、UIは React 19.2.5 です。サーバー側の登録は素直で、ツールとリソースをそれぞれ1本足すだけです。

```ts:src/apps/register-search-app.ts
registerAppTool(
  server,
  "search_bids_app",
  {
    title: "官公需入札検索テーブル",
    inputSchema: searchBidsInputSchema,
    outputSchema: BidSearchResultSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    _meta: {
      ui: {
        resourceUri: "ui://jp-bids/search-results.html",
      },
    },
  },
  async (args) => {
    const result = capSearchResult(await client.search(buildSearchBidsParams(args)));
    return {
      content: [{ type: "text" as const, text: formatSearchSummary(result) }],
      structuredContent: result,
    };
  },
);
```

ここで見落としやすいのは、`content` と `structuredContent` を**画面があっても返し続けている**ことです。`_meta.ui.resourceUri` はホストへの申し出であって、命令ではありません。MCP Apps に対応していないクライアントは `_meta` を素通りし、テキスト要約と構造化データだけを受け取ります。画面はあくまで追加のレイヤで、なければ壊れるものではない。この順序を逆にすると、対応クライアント以外でツールが無価値になります。

なお `_meta.ui.resourceUri` と旧形式の `ui/resourceUri` は ext-apps が両方書き出します。移行期の仕様に片方だけ賭けない、という判断がライブラリ側で済んでいるので、こちらは新しい形だけを書けばよい。

![起動直後のWelcome画面。入力例と、チャットから search_bids_app を指示する案内](/images/mcp-apps-bid-workspace/01-welcome.png)

ホスト・iframe・MCPサーバーの三者は、次のように分かれています。

```mermaid
sequenceDiagram
    participant Model as ホストのモデル
    participant Host as ホスト (Claude / ChatGPT)
    participant App as iframe (単一HTML)
    participant Server as JP Bids MCP

    Model->>Host: search_bids_app を呼ぶ
    Host->>Server: tools/call
    Server-->>Host: text + structuredContent
    Host->>Server: resources/read ui://jp-bids/search-results.html
    Server-->>Host: text/html;profile=mcp-app
    Host->>App: iframe で描画
    App->>Host: ui/initialize
    Host-->>App: hostCapabilities + hostContext
    Host->>App: ui/notifications/tool-result
    Note over App: ここから先、アプリは<br/>ホスト経由でしか外に出られない
    App->>Host: ui/message / ui/download-file / ui/open-link
    Host->>Model: 整形された発話として届く
```

## 単一HTMLという制約 — 558KB を1ファイルに畳む理由

MCP Apps のUIは、JavaScript も CSS も画像も inline された単一のHTMLファイルとして配信する必要があります。JP Bids の実測値は 162 modules から 558,006 bytes、gzip 149.38 KiB です（`npm run build:ui` の出力、v0.8.0時点）。React と ReactDOM を丸ごと含んでこの大きさに収まります。

畳んでいるのは `vite-plugin-singlefile` です。

```ts:vite.config.ts
export default defineConfig({
  root: "ui",
  plugins: [react(), viteSingleFile()],
  build: {
    emptyOutDir: false,
    outDir: "../dist/apps",
    rollupOptions: {
      input: "search-results.html",
    },
  },
});
```

なぜ分割配信ではなく単一ファイルなのか。理由はビルドの好みではなく、リソースの `_meta` に自分で書いた次の宣言にあります。

```ts:src/apps/register-search-app.ts
_meta: {
  ui: {
    csp: {
      connectDomains: [],
      resourceDomains: [],
    },
    permissions: {
      clipboardWrite: {},
    },
  },
},
```

`connectDomains: []` と `resourceDomains: []` は、「このアプリはどのドメインにも接続しないし、どこからも読み込まない」という空の許可リストです。CDNからReactを引くことも、フォントを取ることも、自分のAPIを叩くこともできません。つまり**データがアプリに入る経路は tool result ただ一つ**になります。分割配信は選択肢として存在しないのではなく、この宣言と両立しません。

`clipboardWrite` だけを例外として要求しているのは、後述するホスト拒否時の退避先に必要だからです。権限は欲しいから要求するのではなく、退避経路が要るから要求する。

| 配信方式 | 外部依存 | CSP宣言 | JP Bids の採用 |
|---|---|---|---|
| **単一HTML** | なし | `connectDomains: []` で閉じられる | 採用 |
| **CDN分割** | CDN可用性に従属 | `resourceDomains` にCDNを列挙 | 不採用 |
| **自前API直叩き** | 自サーバーに従属 | `connectDomains` に自ドメイン | 不採用 |

ダークモードも同じ1ファイルに入っています。`prefers-color-scheme: dark` のメディアクエリで切り替わるので、ホストが渡す `hostContext.theme` に依存しません。ホストがテーマを教えてくれるかどうかは、この画面の見た目を左右しません。

![ダークモード。同じ単一HTMLがOS設定に従って切り替わる](/images/mcp-apps-bid-workspace/04-dark.png)

## ホストアクション7種と、拒否されたときの設計

ホストアクションは、iframe の中のアプリがホストに何かを依頼するための7つの口です。依頼である以上すべて断られる可能性があり、MCP Apps 実装の分水嶺は機能の数ではなく、**断られたときに何が起きるかが書かれているか**にあります。

| アクション | 用途 | 拒否されたときの退避先 |
|---|---|---|
| `ui/initialize` | ホスト能力と文脈の取得 | 接続失敗としてUIに表示 |
| `toolinput` / `toolresult` | 検索の開始と結果の受領 | 前回結果を半透明で残す |
| `sendMessage` | 判断アクションをchatへ | clipboard → 手入力の案内 |
| `callServerTool` | アプリ内から再検索 | エラー文でユーザーに再試行を促す |
| `downloadFile` | CSV / ICS / メモの持ち帰り | clipboard → 案内文 |
| `openLink` | 公式公告ページを開く | 「tool result の resource_link を見てください」 |
| `requestDisplayMode` | fullscreen / inline の切替 | ボタン自体を出さない |

最後の行が地味に重要です。`requestDisplayMode` のボタンは、ホストが `availableDisplayModes` に `fullscreen` を含めて申告したときにだけ描画されます。

```tsx:src/apps/search-results.tsx
{availableDisplayModes.includes("fullscreen") && (
  <button className="btn-icon" type="button" onClick={/* ... */}>
    {displayMode === "fullscreen" ? "↙" : "↗"}
  </button>
)}
```

押せないボタンを出してエラーを見せるより、出さないほうが親切です。能力の申告は、拒否を事前に処理する材料として使えます。

`openLink` には、ホストの判断より手前に自分の許可リストを置いています。

```tsx:src/apps/search-results.tsx
function isAllowedOfficialLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === "https://www.kkj.go.jp" || parsed.origin === "https://mcp.bid-jp.com";
  } catch {
    return false;
  }
}
```

`externalDocumentUri` は上流の公告データに含まれる文字列であり、こちらが作った値ではありません。未信頼データを `openLink` にそのまま渡さない、という一行です。ホストも検証するはずですが、それを理由に自分の側で省く根拠にはなりません。

![モバイル幅。案件一覧と詳細が縦に積まれ、Action Dock は折り返す](/images/mcp-apps-bid-workspace/05-mobile.png)

## sendMessage はツールを呼ばない — 整形された発話を送る

`sendMessage`（`ui/message`）は、アプリがツールを直接実行するための口ではなく、**ユーザーの発話としてchatにテキストを差し込むための口**です。Action Dock の「読む / 判定 / まとめる / 聞く」は `extract_bid_requirements` を呼びません。ツール名とJSON引数を含んだ日本語のメッセージを組み立ててchatに送り、実際に呼ぶかどうかはホストのモデルが決めます。

```tsx:src/apps/search-results.tsx
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
```

最初はこれを回りくどい設計だと思っていました。呼びたいツールが決まっているなら直接呼べばよいはずです。しかしこの形には、直接呼び出しにはない性質が二つあります。

ひとつは、**会話の履歴に残ること**です。アプリが裏でツールを実行すると、モデルは自分の文脈の外で何が起きたか知りません。ユーザーの発話として通せば、抽出結果はモデルが読んだ材料として会話に積まれ、次の質問が続けられます。もうひとつは、**モデルに拒否の余地を残すこと**です。引数まで書いた依頼を渡しても、判断はモデル側にあります。画面がモデルの手を縛らない。

そのうえで、この口が使えない場合が三段構えで書かれています。

```tsx:src/apps/search-results.tsx
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
```

`getHostCapabilities()?.message` が無ければ送らない。送って `isError` が返れば落ちる。例外が飛んでも落ちる。最後は clipboard にコピーして「チャットに貼り付けて送信してください」と伝え、clipboard すら拒否されたら「チャットで『この案件を読む』と入力してください」と書く。下の画面は、ホストが `ui/message` を拒否し、headless環境で clipboard も使えなかったときの最終段です。

![ホストがsendMessageを拒否し、clipboardも使えなかったときの最終案内](/images/mcp-apps-bid-workspace/06-fallback.png)

同じ三段構えを `downloadFile` にも通しています。ICSカレンダー、検討メモのMarkdown、CSVは、ホストが保存してくれればファイルになり、断られれば clipboard に落ち、それも駄目なら案内文になります。

```tsx:src/apps/search-results.tsx
try {
  const result = await app.downloadFile({
    contents: [{ type: "resource", resource: { uri, mimeType, text } }],
  });
  if (result.isError) {
    await copyToClipboard();
    return;
  }
  setActionMessage(successMessage);
} catch {
  await copyToClipboard();
}
```

ここで一度もエラーダイアログを出していないことが、この節の主張です。ユーザーがやりたいのは「締切をカレンダーに入れる」ことで、`ui/download-file` が通ったかどうかではありません。ホストの拒否はUIの内部事情であって、ユーザーの失敗ではない。

## ホストの癖に当てた二つのパッチ

仕様書を読んでも出てこない挙動が二つあり、どちらも実機で初めて分かりました。仕様は正しいホストの振る舞いを定義しますが、いま動いているホストの癖は書いていません。

ひとつめは、**2回目の検索でパネルが開き直さないホストがある**という問題です。ユーザーが会話で「次は農林水産省で探して」と頼むと、ツールは実行され結果も返るのに、画面は最初の14件を表示したままになります。仕様の側から見れば `ui/notifications/tool-result` が来ていないだけですが、使う側から見れば画面が固まっています。

対処は、iframe の中に検索バーを置き、`callServerTool` で自分から取り直すことでした（CHANGELOG 0.7.0）。

```tsx:src/apps/search-results.tsx
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
```

ホストの通知に依存しない経路をひとつ持っておく。会話からの検索が壊れているホストでも、画面の中の検索窓は動きます。

ふたつめは、検索中の表示です。`toolinput` を受け取った時点で古い結果を消すと、画面が一瞬空になり、判断材料が視界から消えます。消さずに残し、CSSで触れないようにしました。

```css:src/apps/search-results.css
.ws-body--loading {
  opacity: 0.5;
  pointer-events: none;
}
```

```tsx:src/apps/search-results.tsx
<div className={`ws-body${isSearching ? " ws-body--loading" : ""}`}>
```

2行のCSSですが、これが「会話は流れ、判断材料は留まる」という最初の動機に直接応えている部分です。読み込み中に前の結果が消える画面は、チャットの履歴を上にスクロールする作業に戻ってしまいます。

## React を起動せずにスコアを検証する

`search-results.tsx` は827行あり、その中でホストとの通信と判断ロジックが混ざります。スコアリングと期限計算だけを純粋なTypeScriptとして `src/apps/bid-workspace-view-model.ts`（144行）に切り出したのは、ホストのモックを書かずにテストしたかったからです。

```ts:src/apps/bid-workspace-view-model.ts
function computeDeadlineUrgency(
  daysUntilDeadline: number | null,
): BidCardViewModel["deadlineUrgency"] {
  if (daysUntilDeadline === null) {
    return "unknown";
  }
  if (daysUntilDeadline < 0) {
    return "overdue";
  }
  if (daysUntilDeadline <= 7) {
    return "urgent";
  }
  return "normal";
}
```

`now` を引数で受けるので、テストは時刻を固定できます。

```ts:tests/apps/bid-workspace-view-model.test.ts
const now = new Date("2026-05-03T09:00:00Z");

it("computes deadline urgency and quick score", () => {
  const card = toBidCardViewModel(
    {
      resultId: 1,
      key: "KKJ-001",
      projectName: "システム保守",
      tenderSubmissionDeadline: "2026-05-06T17:00:00+09:00",
      externalDocumentUri: "https://example.test/notice.pdf",
      certification: "A",
    },
    now,
  );

  expect(card.deadlineUrgency).toBe("urgent");
  expect(card.quickScore).toBeGreaterThanOrEqual(70);
  expect(card.priorityLabel).toBe("pursue");
});
```

React も jsdom も postMessage のモックも出てきません。v0.8.0 のテストは25ファイル134件で、1秒未満で終わります（`npm test` 実測）。UIの内側にある判断ロジックが速くテストできる状態は、iframe の中に閉じたコードでも作れます。

もうひとつ、この記事で正直に書いておきたいことがあります。ADR-0014 と `docs/mcp-apps.md` には、Evidence & Safety パネルが `sourceUri`・SHA-256・抽出modeを表示すると書いてありました。実装が表示しているのは、未信頼データ警告・入札 `key`・ファイル種別・ファイルサイズ・出典・取得日時です。

![Evidence & Safety パネル。SHA-256 は無い](/images/mcp-apps-bid-workspace/03-evidence.png)

理由は単純で、SHA-256 は `src/api/pdf-fetcher.ts` が**文書を取得したときに**サーバー側で計算する値だからです。検索結果は文書取得より前の段階なので、このパネルが描画される時点でその値は存在しません。ADRを書いた時点では、検索結果と抽出結果を同じ画面に置くつもりでいて、その差に気づいていませんでした。

v0.8.0 では、実装を追いつかせるのではなくADRを実態に合わせ、なぜ見送るのかを書きました。表示するには、アプリの状態モデルを「ひとつの tool result」から「複数の tool result を統合したビュー」に変える必要があります。それは画面の性質を変える変更で、未信頼データ警告がこのパネルの安全上の役目を既に果たしていることを考えると、いま払う代価ではない。

ADRに書いたことが必ずしも出荷されていない、という事実は隠すよりも記録したほうが安全です。設計文書は、読んだ人が実装を信頼するために存在します。ずれたまま放置された設計文書は、無い設計文書より害があります。

## 本番UIを、本番コードに触らずに撮る

スクリーンショットは、本番バンドルをモックホストの iframe に載せて撮っています。この記事の6枚はすべて `dist/apps/search-results.html` そのもので、撮影用に改変したビルドではありません。

ハーネスは `ui/initialize` に応答し、固定の tool result を1回流すだけの240行のHTMLです（`scripts/apps-harness/host.html`）。`hostCapabilities` を組み替えられるので、`denyMessage=1` を付ければホストが `ui/message` を拒否する経路が再現でき、上のフォールバック画面が撮れます。撮影は CDP 経由で、`prefers-color-scheme` を `dark` に切り替えてダークモードも同じ手順で取得します（`scripts/apps-harness/capture.ts`）。

```bash
npm run apps:capture
```

審査に画面を提出する必要がある人には、この形がそのまま使えます。決定的なデータで、決定的な時刻で、ホストの拒否まで含めて撮れる。そして本番コードには一行も手を入れていないので、撮った画面が嘘にならない。

## 終わりに

会話の中に画面を置くのは、画面を増やすためではありません。

チャットは速い媒体です。速いので、判断材料も一緒に流していってしまう。14件の一覧、2日後の締切、まだ読んでいない仕様書。これらは流れてはいけないもので、だから会話の横に留まる場所が要る。MCP Apps の7つのホストアクションは、そのために「画面から会話へ戻る道」を用意しているのであって、画面の中で完結させるための道具ではありません。

`sendMessage` がツールを呼ばずに発話を送るのは、この方向を守るためです。判断は最後までモデルとユーザーの側にあり、画面はその材料を消さずに持っているだけ。

もっとも、この記事で一番時間を使ったのは仕様の解釈ではありませんでした。ホストが断ったときにユーザーに何と言うか、その日本語を決めることでした。仕様は成功したときの形を定義しますが、断られたときに誰が困るかは書いていません。

## 参考 / References

- [Model Context Protocol 仕様](https://modelcontextprotocol.io/specification/2025-11-25)
- [JP Bids MCP — GitHub](https://github.com/sugukurukabe/koko-call-mcp)（`src/apps/` に本記事のコード、`docs/adr/0014-mcp-apps-host-actions.md` に設計判断）
- [中小企業庁 官公需情報ポータルサイト](https://www.kkj.go.jp/)
- [JP Bids MCP × Jグランツ MCP × freee MCP — 入札・補助金・会計をひとつの会話で](https://zenn.dev/sugukuru_labs/articles/zenn-jp-bids-jgrants)
- [Public MCP JP Gateway — 公的データMCPを束ねる](https://zenn.dev/sugukuru_labs/articles/public-mcp-jp-gateway)

データ出典: 中小企業庁 官公需情報ポータルサイト。入札判断の前に必ず公式の調達書類を確認してください。
