# Security Policy / セキュリティポリシー / Kebijakan Keamanan

## Supported Versions / サポート対象バージョン / Versi yang Didukung

| Version | Supported / サポート / Didukung |
|---------|--------------------------------|
| 0.1.x   | ✅ Yes / はい / Ya            |

## Reporting a Vulnerability / 脆弱性の報告 / Melaporkan Kerentanan

**連絡先 / Contact / Kontak:**
- Email: security@sugu-kuru.co.jp
- 件名 / Subject / Subjek: `[SECURITY] Public MCP JP Gateway - <description>`

**報告内容 / Report Contents / Isi Laporan:**
1. 脆弱性の概要 / Summary of vulnerability / Ringkasan kerentanan
2. 再現手順 / Reproduction steps / Langkah-langkah reproduksi
3. 影響範囲 / Impact scope / Cakupan dampak
4. 提案される修正 / Suggested fix / Perbaikan yang disarankan

**対応ポリシー / Response Policy / Kebijakan Respons:**
- 24時間以内に受領確認 / Acknowledgment within 24 hours / Konfirmasi dalam 24 jam
- 7日以内に詳細調査と対応計画 / Detailed investigation and response plan within 7 days / Investigasi detail dan rencana respons dalam 7 hari
- 重大な脆弱性は 30日以内に修正と公開 / Critical vulnerabilities fixed and disclosed within 30 days / Kerentanan kritis diperbaiki dan diungkapkan dalam 30 hari

## Security Principles / セキュリティ原則 / Prinsip Keamanan

### 1. Data Minimization / データ最小化 / Minimalisasi Data

**収集するデータ / Data Collected / Data yang Dikumpulkan:**
- リクエスト ID (UUID)
- アクター ハッシュ (Gateway Pro API キーの SHA-256 16文字)
- ツール名
- 決定 (allowed/denied)
- レイテンシ (ms)
- タイムスタンプ

**収集しないデータ / Data NOT Collected / Data yang TIDAK Dikumpulkan:**
- 個人情報 (氏名、住所、電話番号など)
- 財務データ (残高、取引明細、請求書内容)
- OAuth トークン (子 MCP に pass-through のみ、保存しない)
- 完全なリクエスト/レスポンス本文

### 2. OAuth Token Handling / OAuth トークンの扱い / Penanganan Token OAuth

**方針 / Policy / Kebijakan:**
- Gateway は OAuth トークンを**保存しない**
- クライアントから受け取った `X-Mcp-Child-Authorization-{server-id}` ヘッダを、子 MCP に**そのまま転送**
- ログにも記録しない

**実装 / Implementation / Implementasi:**
```typescript
const childAuthHeaders: Record<string, string> = {};
// ヘッダから抽出して子 MCP に転送
// Extract from header and forward to child MCP
// Ekstrak dari header dan teruskan ke MCP anak
```

### 3. Rate Limiting / レート制限 / Pembatasan Laju

**制限 / Limits / Batasan:**
- 無料プラン: 60 requests/minute
- Pro プラン: 600 requests/minute
- 超過時は HTTP 429 を返却

**実装 / Implementation / Implementasi:**
- メモリ内レートリミッター (本番は Redis 推奨)
- クライアント IP または API キー単位で制限

### 4. Authentication / 認証 / Autentikasi

**方式 / Methods / Metode:**
- Bearer Token (Gateway Pro API キー)
- 子 MCP ごとの OAuth pass-through

**セキュリティ要件 / Security Requirements / Persyaratan Keamanan:**
- 本番環境では `GATEWAY_PRO_API_KEYS` が必須
- `GATEWAY_JWT_SECRET` が必須 (本番)
- ローカル開発ではエフェメラルキーを自動生成

### 5. Audit Logging / 監査ログ / Log Audit

**記録内容 / Recorded Contents / Isi yang Direkam:**
- request_id (UUID)
- timestamp (ISO 8601)
- actor_hash (16文字 SHA-256)
- selected_server (gateway / child MCP ID)
- tool_name
- decision (allowed / denied / rate_limited)
- latency_ms

**保持期間 / Retention Period / Periode Penyimpanan:**
- 開発環境: 24時間
- 本番環境: 90日 (コンプライアンス要件による)

**非記録内容 / Non-Recorded Contents / Isi yang Tidak Direkam:**
- 完全なリクエスト/レスポンス本文
- 個人情報
- 財務データ

### 6. Child MCP Security / 子MCPのセキュリティ / Keamanan MCP Anak

**リスクレベル / Risk Levels / Tingkat Risiko:**
- `read_only`: 読み取り専用 (入札、補助金、統計)
- `financial`: 財務データ (会計、試算表)
- `write`: 書き込み操作 (仕訳作成、振込)

**制御 / Controls / Kontrol:**
- `risk_level: financial` の子 MCP は Pro tier + OAuth/API キーが必須
- `required_approval` が設定された書き込み系ツールは `issue_approval_token` が必要
- 承認トークンは HMAC-SHA256 で署名、TTL 5分

### 7. Network Security / ネットワークセキュリティ / Keamanan Jaringan

**本番環境 / Production Environment / Lingkungan Produksi:**
- Cloud Run (Google Cloud) でホスト
- HTTPS (TLS 1.3) 必須
- CORS: 許可オリジンリスト (環境変数 `ALLOWED_ORIGINS`)
- IP 制限: 不要 (API キー認証で代用)

### 8. Vulnerability Disclosure / 脆弱性の開示 / Pengungkapan Kerentanan

**開示ポリシー / Disclosure Policy / Kebijakan Pengungkapan:**
- 重大な脆弱性は 30日以内に公開
- CVE ID を取得 (該当する場合)
- 修正版リリースと同時にセキュリティアドバイザリを発行

**バグバウンティ / Bug Bounty / Bug Bounty:**
- 現時点ではバグバウンティプログラムは未実施
- ただし、脆弱性報告は歓迎

## Contact / 連絡先 / Kontak

- セキュリティ: security@sugu-kuru.co.jp
- 一般: info@sugu-kuru.co.jp
- GitHub: https://github.com/sugukurukabe/koko-call-mcp

---

*最終更新 / Last Updated / Terakhir Diperbarui: 2026-05-11*
*バージョン / Version / Versi: 0.1.0*