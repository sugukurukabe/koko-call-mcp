# Public MCP Federation Hub — 実現可能性・需要・規制境界
# Public MCP Federation Hub — Feasibility, Demand, and Regulatory Boundaries
# Public MCP Federation Hub — Kelayakan, Permintaan, dan Batas Regulasi

調査日 / Research date / Tanggal penelitian: 2026-05-07

---

## エグゼクティブサマリー / Executive Summary / Ringkasan Eksekutif

**日本語**

JP Bids MCPを中核に、官公需・補助金・法人番号・農業統計・会計の公的/業務MCPサーバーを1回の接続で使えるようにするGateway SaaS「Public MCP Federation Hub」の実現可能性は高い。MCP Gatewayカテゴリはすでに成立しており、日本固有の公的データMCPは先行者が少なく参入障壁がある。ただし「gBizID統合」「マイナンバー統合」「ブロックチェーントークン経済」は初期MVPに入れると規制・審査コストで失速する。最初の公開MVPは JP Bids（入札） + Jグランツ（補助金） + AgriOps（農業統計） + 法人番号 + MoneyForward Cloud Accounting（会計） + freee（会計）を束ねる軽量Gatewayとし、GMO銀行系APIは利用許諾とAPI取得が完了した後の private connector として扱う順序が最も安全。

**English**

The "Public MCP Federation Hub" — a Gateway SaaS connecting public procurement, subsidies, corporate registry, agriculture statistics, and accounting MCP servers through a single connection — has high feasibility. The MCP Gateway category is already taking shape globally. Japan-specific public-data MCP servers face lower competition and higher regulatory moats. However, integrating gBizID, My Number, or blockchain tokens in the MVP phase will cause slowdown from regulatory and compliance overhead. The recommended public MVP is a lightweight gateway connecting JP Bids, J-Grants, AgriOps, Corporate Number, MoneyForward Cloud Accounting, and freee. GMO banking APIs should be treated as a future private connector after permission and API access are obtained.

**Bahasa Indonesia**

"Public MCP Federation Hub" — SaaS Gateway yang menghubungkan server MCP pengadaan publik, subsidi, registri korporasi, statistik pertanian, dan akuntansi dalam satu koneksi — memiliki kelayakan tinggi. Kategori MCP Gateway sudah mulai terbentuk secara global. Server MCP data publik khusus Jepang memiliki pesaing yang lebih sedikit dan hambatan regulasi yang lebih tinggi. Namun, mengintegrasikan gBizID, My Number, atau token blockchain di fase MVP akan memperlambat pengembangan karena overhead regulasi dan kepatuhan. MVP publik yang direkomendasikan adalah gateway ringan yang menghubungkan JP Bids, J-Grants, AgriOps, Nomor Korporasi, MoneyForward Cloud Accounting, dan freee. API perbankan GMO diperlakukan sebagai konektor privat masa depan setelah izin dan akses API diperoleh.

---

## 1. 市場・需要 / Market and Demand / Pasar dan Permintaan

### 1-1. グローバルMCP採用状況 / Global MCP Adoption / Adopsi MCP Global

2026年4月時点で以下の事実が確認されている（出典: Digital Applied, MCP Adoption Statistics 2026）:

- 企業AIチームの78%が少なくとも1つのMCPエージェントを本番稼働中
- CTOの67%が12ヶ月以内にMCPをデフォルトの統合標準にすると回答
- MCP公開サーバー数は2025年Q1の1,200から2026年4月に9,400超に拡大（7.8x YoY）
- Remote MCPサーバーの81%がOAuth 2.1で認証
- MCP Gatewayカテゴリ: PingGateway、Permit MCP Gateway、agentgateway（OSS）、Red Hatが展開。OAuth、監査ログ、tool-level authorization、token exchange、rate limitが主要ニーズ。

### 1-2. 日本市場の固有需要 / Japan-specific Demand / Permintaan Khusus Jepang

**確認された事実:**

- freee公式MCPサーバー（freee/freee-mcp）: 会計・人事・請求書等270 API対応、OAuth 2.0 + PKCE、Cursor/Claude Desktop対応、2026年3月公式採択。GitHubスター388、npm週間6,800ダウンロード。
- JグランツMCPサーバー（digital-go-jp/jgrants-mcp-server）: デジタル庁公式OSS、2025年10月24日公開、MIT、Python実装。補助金自然言語検索・添付資料取得・統計サマリー対応。
- JP Bids MCP: 本プロジェクト。KKJ公開API、17ツール、OAuth 2.0、Cloud Run、MCP Apps対応。
- GMOトラスト・ログイン: 日本初のIDaaSがMCPに対応（2026年4月15日）。SaaSアカウント棚卸のread-onlyツールをOAuth 2.1で公開。

**需要仮説:**

中小企業・行政書士・自治体DX担当者は「入札 + 補助金 + 法人確認 + 農業統計 + 会計」を別々のSaaSや公的サイトで調べているため、1回の会話で横断調査できる価値は高い。現在は各MCPを自分でつなぐセットアップが必要であり、Gatewayが「設定不要の一本化接続」と `get_gateway_demo` による初回導線を提供できれば差別化になる。

### 1-3. 競合カテゴリ / Competitive Categories / Kategori Kompetitif

| カテゴリ | 代表例 | 日本公的データ対応 | MCP準拠 |
|---|---|---|---|
| MCP Security Gateway | PingGateway, Permit.io | なし | あり |
| MCP Agent Gateway | agentgateway（OSS） | なし | あり |
| 日本公的データMCP | JP Bids MCP, Jグランツ | あり | あり |
| 業務SaaS MCP | freee MCP, MoneyForward Cloud Accounting MCP | 会計のみ | あり |
| **Federation Hub（未存在）** | **本プロジェクト** | **あり** | **あり** |

日本の公的データ（入札・補助金・法人番号・農業統計）とビジネスSaaS（会計）を束ねるGatewayは現時点で存在しない。

---

## 2. 実現可能性 / Technical Feasibility / Kelayakan Teknis

### 2-1. 実現可能な範囲（初期MVP）/ Feasible for MVP / Layak untuk MVP

| 機能 | 難易度 | 根拠 |
|---|---|---|
| JP Bids MCPへのProxy接続 | 低 | 同一コードベース、Streamable HTTP対応済み |
| JグランツMCPへのProxy接続 | 低 | 公式OSS、Streamable HTTP対応 |
| freee MCPへのProxy接続 | 中 | OAuth 2.0が必要。ユーザー保有tokenを前提にすれば可 |
| GMO銀行系API private connector | 高 | 利用許諾とAPI取得が前提。公開Gatewayでは提供しない |
| MoneyForward Cloud Accounting MCPへのProxy接続 | 中 | OAuthヘッダ pass-through と実ツール名 discovery が必要 |
| 子MCP Registry（JSON/YAML） | 低 | 静的定義で十分 |
| ルールベースSmart Router | 低 | tool descriptionマッチング + 語彙ルール |
| OAuth 2.0 + APIキー認証 | 低 | JP Bids MCPの実装をテンプレートに使える |
| 監査ログ（JSONL/Cloud Logging） | 低 | Cloud Run + Cloud Logging で実現可能 |
| tool-level policy（allowlist/denylist） | 中 | Zodスキーマ + 設定ファイルで実装可能 |

### 2-2. 初期MVPでは実現困難な範囲 / Deferred / Ditangguhkan

| 機能 | 理由 |
|---|---|
| gBizID統合（統一認証） | 行政サービス連携申請が必要。審査・テスト環境構築に最低6週間。 |
| マイナンバー/JPKI連携 | 本人確認SaaSとして別認証・委託先管理が必要。犯収法・携帯不正利用防止法改正対応も必要。 |
| ブロックチェーンRegistry/トークン | 2026-2027の暗号資産規制強化（金商法化）と対立する可能性あり。監査ログの改ざん耐性はWORMログ・Cloud Audit Logs・署名で十分。 |
| Smart Router（LLM自動判定） | v0.1はルールベースで十分。LLMルーターはlatency・コストの問題があり後で追加する方が良い。 |
| 管理UI / ダッシュボード | 需要が確認されてから実装する。 |
| TEE / Confidential Compute | Enterprise顧客と具体的なPoCが取れてから検討する。 |

---

## 3. 規制境界 / Regulatory Boundaries / Batas Regulasi

### 3-1. gBizID / gBizID Regulatory Boundary / Batas Regulasi gBizID

**日本語**: gBizIDはOpenID Connectを使うが、民間SaaSが自由に「統一認証プロバイダー」として使えるものではない。連携できるのは行政機関・行政組織のみであり、民間SaaS側がgBizIDの認証を受けるには、経産省・デジタル庁のサービス連携申請、セキュリティ審査、本番テスト環境の構築が必要（最短6週間）。初期MVPではgBizIDをIDPとして使うのではなく、「gBizIDでログインしている法人ユーザーがAPIキーやOAuthトークンを持ち込む」モデルに留める。

**English**: gBizID uses OpenID Connect but is restricted to government agency integrations. Private SaaS cannot use it as a free-to-integrate universal authentication provider. Integration requires a service linkage application to METI/Digital Agency, a security review, and test environment setup (minimum 6 weeks). For the initial MVP, limit to a model where gBizID-authenticated corporate users bring their own API keys or OAuth tokens.

**Bahasa Indonesia**: gBizID menggunakan OpenID Connect tetapi terbatas pada integrasi instansi pemerintah. SaaS swasta tidak dapat menggunakannya sebagai penyedia autentikasi universal. Integrasi memerlukan pengajuan aplikasi tautan layanan ke METI/Badan Digital, tinjauan keamanan, dan pengaturan lingkungan pengujian (minimal 6 minggu). Untuk MVP awal, batasi pada model di mana pengguna korporat yang terautentikasi gBizID membawa kunci API atau token OAuth mereka sendiri.

### 3-2. マイナンバー/JPKI / My Number / My Number Regulatory Boundary

**日本語**: 2026年4月1日から、携帯電話不正利用防止法の改正により非対面本人確認はJPKIに原則一本化。民間利用拡大中だが、デジタル庁デジタル認証アプリサービスAPIを組み込むには申し込み・審査・テスト環境検証が必要（2025年9月時点で400以上が問い合わせ、210以上が申し込み済み）。本人確認サービスを提供する場合は委託先管理、ユーザー同意の適切な取得、特定個人情報の利用制限が法的に課される。Public MCP Federation HubがJPKI認証を代行する場合は、法人番号確認程度に留め、実際の本人確認は各連携先サービスに委ねるモデルにする。

**English**: As of April 1, 2026, non-face-to-face identity verification is being unified to JPKI under amendments to the Mobile Phone Unauthorized Use Prevention Act. Private use is expanding, but integrating the Digital Agency's Digital Authentication App Service API requires an application, review, and test environment verification. If the Hub acts as an identity verification intermediary, limit the scope to corporate number verification and delegate actual identity verification to each connected service.

**Bahasa Indonesia**: Mulai 1 April 2026, verifikasi identitas non-tatap-muka disatukan ke JPKI di bawah amandemen Undang-Undang Pencegahan Penggunaan Tidak Sah Telepon Genggam. Jika Hub bertindak sebagai perantara verifikasi identitas, batasi cakupan pada verifikasi nomor korporasi dan delegasikan verifikasi identitas aktual ke setiap layanan yang terhubung.

### 3-3. 監査ログのデータ保存方針 / Audit Log Data Retention Policy / Kebijakan Penyimpanan Data Log Audit

監査ログに保存するのは以下のみ。入力全文・添付資料・個人情報は保存しない。

| 保存する情報 | 保存しない情報 |
|---|---|
| request_id（UUIDv4） | tool引数の全テキスト |
| actor（ハッシュ化されたAPIキーまたはsub） | 入札件名・補助金名・取引内容 |
| selected_server（JP Bids/Jグランツ/freee） | PDFの内容・添付資料 |
| tool_name | 財務データ・会計数字 |
| decision（allowed/denied） | 個人情報・氏名・住所 |
| attribution（出典URL） | |
| timestamp（ISO 8601） | |
| latency_ms | |

### 3-4. ブロックチェーン/暗号資産 / Blockchain / Blockchain Regulatory Notes

2026-2027にかけて日本では暗号資産が金融商品取引法（金商法）寄りに再分類される流れにある（金融審議会作業部会、2026年1月）。ユーティリティトークン・決済トークンであっても投資商品性が認められれば開示義務・インサイダー取引禁止の対象となる可能性がある。初期SaaS段階でトークン経済を設計するのはリスクが高い。監査ログの改ざん耐性はWORMログ（Cloud Storage with retention lock）、署名付きイベント（ED25519）、Cloud Audit Logsで十分に達成できる。

---

## 4. 競合分析 / Competitive Analysis / Analisis Kompetitif

### 4-1. グローバルMCP Gateway / Global MCP Gateways / MCP Gateway Global

| 製品 | 強み | 弱み |
|---|---|---|
| PingGateway | エンタープライズ認証、OAuth変換 | 日本語なし、高コスト、日本公的データ非対応 |
| Permit MCP Gateway | tool-level authorization、監査ログ | 日本公的データ非対応、英語製品 |
| agentgateway（Cloudflare OSS） | OSSで無料、MCP/SSE/A2A対応 | 日本公的データ非対応、自己ホスト必要 |
| Red Hat/Keycloak MCP Auth | エンタープライズIDaaS統合 | 日本公的データ非対応、重量級 |

### 4-2. 日本固有の競合優位 / Japan-specific Competitive Advantages / Keunggulan Kompetitif Khusus Jepang

Public MCP Federation Hubの差別化要因:

1. **日本公的データの深い理解**: JP Bids（KKJ API）の仕様上の落とし穴、Jグランツ補助金の統計意味論、freee会計との接続パターンを同時に保有するのは現状唯一。
2. **規制先読み設計**: gBizID非依存・マイナンバー非管理のゼロトラスト設計により、規制強化時の再設計コストが低い。
3. **日本語ファーストの监査ログ/説明**: 日本の中小企業・行政書士が読めるインシデントレポートとaudit export。
4. **先行者利益**: 日本の公的データMCP Fedration HubはQ3 2026時点で存在しない。MCP採用が加速する今が参入ウィンドウ。

---

## 5. Go / No-Go基準 / Go / No-Go Criteria / Kriteria Go / No-Go

### Go条件 / Go Conditions / Kondisi Go

Private Beta（Week 7-10）終了時点で以下を3件以上満たす:

- [ ] 「自社の会計/CRM MCPもつなぎたい」という要望が出る
- [ ] 1ユーザーあたり週3回以上、複数MCP横断の実行が記録される
- [ ] 監査ログ/権限管理に対して明確な支払い意思（月額5,000円以上）が確認される
- [ ] JP Bids単体より Hub経由デモの方が商談化率が高い（定性評価）
- [ ] 「設定が面倒」という不満よりも「もっと繋げたい」という要望の方が多い

### No-Go条件 / No-Go Conditions / Kondisi No-Go

以下のいずれかが Private Beta で確認された場合:

- [ ] ユーザーがMCPを複数つなぐ痛みをそもそも感じていない
- [ ] JP Bids単体の検索体験だけで十分と言われ、連携への関心が低い
- [ ] 認証・監査への支払い意思がなく、「便利なデモ」で止まる
- [ ] freee/Jグランツとの接続がOAuth再認証の摩擦で利用が途切れる

No-Goになった場合は、Hub SaaSに発展させず、JP Bids MCP Proの「連携テンプレート集」として畳む。

---

## 6. 次のステップ / Next Steps / Langkah Selanjutnya

1. `docs/adr/0016-public-mcp-federation-hub.md` を作成する（JP Bids本体と別サービスにする設計判断）
2. `docs/public-mcp-hub/architecture.md` でGatewayのMVP設計を確定する
3. `gateway/` ディレクトリで TypeScript MCP Gateway の実装を開始する
4. Week 5-6 で「鹿児島県のIT入札 + 補助金 + 会計余力」デモを完成させる
5. Week 7-10 で Private Beta 参加者を5-10件集める

---

*出典 / Sources / Sumber:*
- *MCP Adoption Statistics 2026 — Digital Applied*
- *freee/freee-mcp — freee株式会社 GitHub (2026-03-02公開)*
- *digital-go-jp/jgrants-mcp-server — デジタル庁 GitHub (2025-10-24公開)*
- *GMOトラスト・ログイン MCP対応 — GMO (2026-04-15)*
- *gBizIDシステム連携ガイド — 経済産業省*
- *マイナンバーカード活用情報 — デジタル庁 (2026-03-31時点)*
- *金融審議会暗号資産ワーキンググループ — NRI Finsights (2026-01-08)*
