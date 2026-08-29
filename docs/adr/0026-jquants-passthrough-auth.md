# ADR-0026: J-Quants API キーのパススルー認証
# ADR-0026: J-Quants API Key Passthrough Authentication
# ADR-0026: Autentikasi Passthrough Kunci API J-Quants

## Status / Status / Status

Accepted / Accepted / Diterima

## Context / 背景 / Konteks

**日本語**

Investor Radar の株価系列は [J-Quants API v2](https://jpx-jquants.com/) から取得する。公式の j-quants-doc-mcp はドキュメント専用であり、データ取得用の公式リモート MCP はない。ADR-0021（MoneyForward）と同じく、サーバーがユーザーの秘密を永続化してはならない。

J-Quants の利用規約は API キーの再配布と、取得データの不特定多数への再配信を制限する。キャッシュをユーザー間で共有すると規約違反になりうる。

**English**

Investor Radar fetches price series from [J-Quants API v2](https://jpx-jquants.com/). The official j-quants-doc-mcp is documentation-only. Following ADR-0021, this server must not persist user secrets.

J-Quants terms restrict redistributing API keys and republishing retrieved data to an unspecified audience. Cross-user caches can violate those terms.

**Bahasa Indonesia**

Investor Radar mengambil deret harga dari J-Quants API v2. Server ini tidak boleh menyimpan rahasia pengguna secara persisten (ADR-0021). Cache lintas pengguna dapat melanggar ketentuan J-Quants.

## Decision / 決定 / Keputusan

### 1. キーの入手経路 / Key sources / Sumber kunci

優先順:

1. ツール引数 `jquants_api_key`（ホストが引数をログする可能性があることを description に書く）
2. 環境変数 `JQUANTS_API_KEY`（stdio / 単一ユーザー運用）

サーバーはキーをファイル・DB・監査ログに書かない。`console.error` にも出さない。Authorization ヘッダはエラーオブジェクトへコピーしない。

### 2. 認証フロー / Auth flow / Alur autentikasi

J-Quants v2 の refresh token を `POST /v2/token/auth_refresh` に渡し、短命の `idToken` を得る。以降の GET は `Authorization: Bearer <idToken>`。

idToken はメモリ上のみ、キーの SHA-256 ハッシュを名前空間として TTL 20 時間で保持する。生キーはキャッシュキーに使わない。

### 3. データキャッシュ / Data cache / Cache data

- LRU。キー空間は `sha256(apiKey).slice(0, 16) + ":" + request`。
- ユーザー間でエントリを共有しない。
- キー未指定時は J-Quants を呼ばず、バンドル済み上場カタログだけで名寄せする。
- レート制限は KKJ と同様トークンバケット（既定 1 req/s）。429/5xx のみ再試行。

### 4. 再配布 / Redistribution / Distribusi ulang

ツールは呼び出し元へ事実を返すだけであり、J-Quants 生データの二次配信サービスではない。出力に J-Quants 出典を付す。添付や全市場スナップショットの保存・コミットはしない（AGENTS.md）。

## Consequences / 影響 / Konsekuensi

良い影響: サーバーが J-Quants 契約主体にならない。MoneyForward と同じ「鍵は利用者が持つ」モデル。

制約: HTTP マルチテナントでヘッダパススルー（`X-Jquants-Api-Key`）は未実装。ツール引数は会話履歴に残る可能性があるため、stdio では環境変数を推奨する。

## Related ADRs / 関連 ADR / ADR Terkait

- ADR-0021 MoneyForward header passthrough
- ADR-0025 Investor Radar scope

## References / 参考 / Referensi

- [J-Quants API](https://jpx-jquants.com/)
- [jquants-mcp](https://github.com/shigechika/jquants-mcp)（コミュニティ実装。本サーバーは自前の最小クライアントを持つ）
