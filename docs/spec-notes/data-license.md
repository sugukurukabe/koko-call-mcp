# データ利用・出典メモ / Data License Notes / Catatan Lisensi Data

## 日本語

- 出典は「中小企業庁 官公需情報ポータルサイト」。各Toolの構造化出力に `attribution` を必須で含める。
- Toolの人間向け `content` にも出典、取得時刻、免責を含める。
- 取得データの丸ごと再配布や商用データ販売に見える使い方は避ける。
- 添付PDFや公告資料はURIを返すだけとし、MCPサーバーでは保存しない。
- 過大な負荷を避けるため、同一クエリの短時間キャッシュ、1秒1リクエスト程度のレート制限、10秒タイムアウトを入れる。

## English

- The data source is the Small and Medium Enterprise Agency KKJ portal. Every structured tool result must include `attribution`.
- Human-readable `content` also includes source, access time, and disclaimer text.
- Avoid bulk redistribution or behavior that resembles resale of the data itself.
- Attachments and procurement documents are returned as URIs only; the MCP server does not store them.
- To avoid excessive load, the server uses short-term query caching, roughly one request per second rate limiting, and a 10 second timeout.

## Bahasa Indonesia

- Sumber data adalah portal KKJ dari Small and Medium Enterprise Agency. Setiap hasil tool terstruktur wajib menyertakan `attribution`.
- `content` yang dibaca manusia juga menyertakan sumber, waktu akses, dan disclaimer.
- Hindari redistribusi massal atau penggunaan yang terlihat seperti penjualan ulang data.
- Lampiran dan dokumen pengadaan hanya dikembalikan sebagai URI; server MCP tidak menyimpannya.
- Untuk menghindari beban berlebih, server memakai cache singkat untuk query yang sama, batas sekitar satu request per detik, dan timeout 10 detik.
