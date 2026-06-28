# スクリーンショット再生成手順 / Screenshot Regeneration / Cara Membuat Ulang Screenshot

申請用スクショ5枚（`docs/submissions/assets/`）を、実UIを実データで描画して再生成する手順。
Regenerate the 5 submission screenshots by rendering the real UI with realistic data.
Cara membuat ulang 5 screenshot dengan UI asli dan data realistis.

> ポイント / Key point: 本番UI(`src/apps/search-results.tsx`)には一切手を入れない。
> ビルド済み単一HTMLを「モックMCP Appsホスト」がiframeで読み込み、`ui/initialize` → `ui/notifications/tool-result` を送って描画する。

## 手順 / Steps

1. UIをビルド / Build the UI

```bash
npm run build:ui   # → dist/apps/search-results.html
```

2. モックホスト harness を `dist/apps/harness.html` に置く（このリポジトリの会話履歴にある雛形を使用）。
   - `ui/initialize` リクエストに `protocolVersion / hostInfo / hostCapabilities / hostContext` を返す
   - `ui/notifications/initialized` 受信後に `ui/notifications/tool-result`（`structuredContent` = `BidSearchResult`）を送る
   - `location.hash` で表示を切替: `#welcome`（データ無し=Welcome） / `#list` / `#evidence`（出典パネル展開）
   - 日付は `令和8年7月10日` 形式（`parseJapaneseDateToDate` が解釈できる）にすると締切バッジが色付きで出る

3. `dist/apps` をローカル配信 / Serve dist/apps

```bash
cd dist/apps && python3 -m http.server 8899 --bind 127.0.0.1
```

4. Chrome（chrome-devtools MCP 等）でキャプチャ / Capture
   - viewport: デスクトップ `1280x860`、DPR 2（retina）／モバイル `414x820`、DPR 3
   - `colorScheme: dark` でダークモード
   - 各 `#variant` をナビゲートして `take_screenshot`（PNG, app応答のみにトリミング）

| File | hash | viewport | colorScheme |
|---|---|---|---|
| screenshot-01-welcome.png | `#welcome` | 1280x860x2 | light |
| screenshot-02-search-results.png | `#list` | 1280x860x2 | light |
| screenshot-03-evidence.png | `#evidence` | 1280x860x2 | light |
| screenshot-04-dark.png | `#list` | 1280x860x2 | dark |
| screenshot-05-mobile.png | `#list` | 414x820x3 (mobile) | light |

5. 後片付け / Cleanup

```bash
rm -f dist/apps/harness.html   # 出荷物ではない / not shipped
# stop the http.server process
```

要件 / Requirements: PNG・幅 ≥1000px・チャットのプロンプトは写さずアプリ応答のみ。
