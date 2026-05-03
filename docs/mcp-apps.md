# MCP Apps UI

## 日本語

JP Bids MCP v0.4.0 は、MCP Apps対応クライアント向けに検索結果テーブルUIを提供します。

使うtool:

- `search_bids_app`

表示されるresource:

- `ui://jp-bids/search-results.html`

動作方針:

- MCP Apps対応クライアントでは、検索結果を表形式で表示します。
- `downloadFile` でCSV downloadをhostへ依頼します。拒否または未対応の場合はclipboard copyへfallbackします。
- `sendMessage` で先頭の入札をchatへ送り、次の調査項目を依頼できます。
- `openLink` で公式ページをhost経由で開きます。
- Hostがsampling対応を宣言している場合のみ、`createSamplingMessage` で先頭の入札のAI briefを作ります。未対応・失敗時は `sendMessage` fallbackを使います。
- `updateModelContext` で現在表示中の検索結果を次のmodel turn向けcontextへ同期します。
- Hostがfullscreenを許可している場合、`requestDisplayMode` でinline/fullscreenを切り替えます。
- MCP Apps非対応クライアントでは、通常のテキスト要約と`structuredContent`を返します。
- 上流の官公需情報ポータルサイトのデータは未信頼データとして扱い、入札判断前に公式ページで確認してください。

確認観点:

- `tools/list` に `search_bids_app` が含まれること。
- `resources/list` に `ui://jp-bids/search-results.html` が含まれること。
- `resources/read` で `text/html;profile=mcp-app` が返ること。
- `search_bids_app` の結果に `structuredContent.bids` と出典情報が含まれること。
- Hostが `downloadFile`、`sendMessage`、`openLink`、`createSamplingMessage` を拒否した時にUIが壊れないこと。
- AI briefが公式書類確認の代替ではなく、次の調査項目の補助として表示されること。
- Model context同期には公開入札メタデータと出典だけが含まれること。
- Display mode変更はhostの応答に従い、強制しないこと。

## English

JP Bids MCP v0.4.0 provides a search-results table UI for MCP Apps-compatible clients.

Tool:

- `search_bids_app`

Rendered resource:

- `ui://jp-bids/search-results.html`

Behavior:

- MCP Apps-compatible clients can render search results as a table.
- The app asks the host to download CSV through `downloadFile`. If denied or unsupported, it falls back to clipboard copy.
- The app can send the top bid to chat through `sendMessage` for follow-up investigation.
- The app opens official pages through the host with `openLink`.
- When the host advertises sampling support, the app can create an AI brief for the top bid through `createSamplingMessage`. If unsupported or rejected, it falls back to `sendMessage`.
- The app syncs the visible search results to future model turns through `updateModelContext`.
- When the host allows fullscreen, the app can switch between inline and fullscreen through `requestDisplayMode`.
- Clients without MCP Apps support still receive the normal text summary and `structuredContent`.
- Upstream KKJ portal data is treated as untrusted data. Always verify official pages before bid decisions.

Verification points:

- `tools/list` includes `search_bids_app`.
- `resources/list` includes `ui://jp-bids/search-results.html`.
- `resources/read` returns `text/html;profile=mcp-app`.
- `search_bids_app` results include `structuredContent.bids` and attribution.
- The UI does not break when the host rejects `downloadFile`, `sendMessage`, `openLink`, or `createSamplingMessage`.
- The AI brief is shown as investigation support, not a replacement for official document review.
- Model context sync contains only public bid metadata and attribution.
- Display mode changes follow the host response and are not forced.

## Bahasa Indonesia

JP Bids MCP v0.4.0 menyediakan UI tabel hasil pencarian untuk klien yang kompatibel dengan MCP Apps.

Tool:

- `search_bids_app`

Resource yang ditampilkan:

- `ui://jp-bids/search-results.html`

Perilaku:

- Klien yang kompatibel dengan MCP Apps dapat menampilkan hasil pencarian sebagai tabel.
- Aplikasi meminta host mengunduh CSV melalui `downloadFile`. Jika ditolak atau belum didukung, aplikasi fallback ke clipboard copy.
- Aplikasi dapat mengirim tender teratas ke chat melalui `sendMessage` untuk investigasi lanjutan.
- Aplikasi membuka halaman resmi melalui host dengan `openLink`.
- Jika host menyatakan dukungan sampling, aplikasi dapat membuat AI brief untuk tender teratas melalui `createSamplingMessage`. Jika belum didukung atau ditolak, aplikasi fallback ke `sendMessage`.
- Aplikasi menyinkronkan hasil pencarian yang sedang terlihat ke model turn berikutnya melalui `updateModelContext`.
- Jika host mengizinkan fullscreen, aplikasi dapat beralih antara inline dan fullscreen melalui `requestDisplayMode`.
- Klien tanpa dukungan MCP Apps tetap menerima ringkasan teks biasa dan `structuredContent`.
- Data dari portal KKJ diperlakukan sebagai data tidak tepercaya. Selalu verifikasi halaman resmi sebelum mengambil keputusan tender.

Poin verifikasi:

- `tools/list` memuat `search_bids_app`.
- `resources/list` memuat `ui://jp-bids/search-results.html`.
- `resources/read` mengembalikan `text/html;profile=mcp-app`.
- Hasil `search_bids_app` memuat `structuredContent.bids` dan atribusi sumber.
- UI tidak rusak ketika host menolak `downloadFile`, `sendMessage`, `openLink`, atau `createSamplingMessage`.
- AI brief ditampilkan sebagai bantuan investigasi, bukan pengganti pemeriksaan dokumen resmi.
- Sinkronisasi model context hanya memuat metadata tender publik dan atribusi sumber.
- Perubahan display mode mengikuti respons host dan tidak dipaksakan.
