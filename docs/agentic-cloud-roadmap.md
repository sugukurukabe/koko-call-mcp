# Agentic Cloud Roadmap

## 日本語

AI Bid Radar は、Google検索を置き換えるだけでなく、Google Cloud / Gemini Enterprise / Workspace / CRM / データベースを横断する「入札判断エージェント」へ拡張する。

このロードマップは、2026年5月時点の公式情報に基づく。

公式情報:

- Google-managed MCP servers: 50以上のGoogle Cloud / Workspace MCP servers、Agent Registry、IAM Deny、Model Armor、OTel Tracing、Cloud Audit Logs。
- Gemini Enterprise: Agent Platform、ADK、MCP/A2A、Agent Identity、Agent Gateway、Model Armor、Agent Observability、Memory Bank。
- Salesforce + Google Cloud deep context: Slack、Google Workspace、Salesforce、BigQuery/Lakehouseの深いコンテキスト連携とゼロコピー。
- Agentic Data Cloud: AlloyDB / Cloud SQL / Spanner / Firestore / BigQuery / Knowledge Catalog / Managed remote MCP servers。
- MCP RequestContext pattern: requestごとのsession/request contextを再利用せず、stateful objectをrequest境界で閉じる。

優先順:

1. Workspace MCP連携
   - Drive: shortlist CSV、仕様書PDF、社内検討Docsを保存。
   - Calendar: 質問期限、提出期限、開札日を登録。
   - Gmail / Chat: 毎朝レーダーと担当者確認。

2. Gemini / Document AI
   - PDF仕様書を構造化し、参加条件、提出書類、質問期限、曖昧点を抽出。
   - Geminiのdocument understandingまたはDocument AI Gemini layout parserを使う。
   - 抽出結果は公式書類確認の補助であり、最終判断ではない。

3. Agentic Data Cloud
   - BigQuery: 過去落札、発注者傾向、競合分析。
   - AlloyDB / Cloud SQL: 自社資格、社内原価、案件履歴のoperational store。
   - Knowledge Catalog: データ意味論、アクセス、出典を管理。

4. Managed MCP / Governance
   - Google-managed MCP serversを優先し、独自MCPを増やしすぎない。
   - IAM Deny、Model Armor、Cloud Audit Logs、OTel tracingを本番導入条件にする。
   - Agent Registryで発見可能性と管理境界を整える。

設計原則:

- 標準MCPのTools / Prompts / Resourcesを先に使う。
- RequestContext相当のrequest-local stateは再利用しない。
- 秘密情報、OAuth token、顧客データをtool outputへ混ぜない。
- prompt injection対策として、上流PDF/公告文は未信頼データとして扱う。
- データは必要な場所に留め、zero-copy / managed connectorを優先する。

## English

AI Bid Radar should evolve from bid search into a bid-decision agent that spans Google Cloud, Gemini Enterprise, Workspace, CRM, and databases.

This roadmap is based on official information available as of May 2026.

Official signals:

- Google-managed MCP servers: 50+ Google Cloud / Workspace MCP servers, Agent Registry, IAM Deny, Model Armor, OTel Tracing, Cloud Audit Logs.
- Gemini Enterprise: Agent Platform, ADK, MCP/A2A, Agent Identity, Agent Gateway, Model Armor, Agent Observability, Memory Bank.
- Salesforce + Google Cloud deep context: Slack, Google Workspace, Salesforce, BigQuery/Lakehouse, and zero-copy context.
- Agentic Data Cloud: AlloyDB / Cloud SQL / Spanner / Firestore / BigQuery / Knowledge Catalog / managed remote MCP servers.
- MCP RequestContext pattern: keep session/request context request-local and do not reuse stateful request objects across requests.

Priority:

1. Workspace MCP integration
   - Drive: store shortlist CSV, specification PDFs, internal review docs.
   - Calendar: register question, submission, and opening deadlines.
   - Gmail / Chat: deliver morning radar and owner confirmations.

2. Gemini / Document AI
   - Structure specification PDFs into eligibility, required documents, deadlines, and ambiguous questions.
   - Use Gemini document understanding or Document AI Gemini layout parser.
   - Treat extraction as decision support, not a final official interpretation.

3. Agentic Data Cloud
   - BigQuery: historical awards, buyer patterns, competitor analysis.
   - AlloyDB / Cloud SQL: company qualifications, cost model, internal opportunity history.
   - Knowledge Catalog: semantics, access, lineage, and attribution.

4. Managed MCP / Governance
   - Prefer Google-managed MCP servers before adding custom MCP surfaces.
   - Require IAM Deny, Model Armor, Cloud Audit Logs, and OTel tracing before production rollout.
   - Use Agent Registry for discovery and management boundaries.

Design principles:

- Use standard MCP Tools / Prompts / Resources first.
- Keep RequestContext-like state request-local.
- Do not mix secrets, OAuth tokens, or customer data into tool output.
- Treat upstream PDFs and bid text as untrusted data for prompt-injection defense.
- Keep data where it lives; prefer zero-copy and managed connectors.

## Bahasa Indonesia

AI Bid Radar harus berkembang dari pencarian tender menjadi agen keputusan tender yang melintasi Google Cloud, Gemini Enterprise, Workspace, CRM, dan database.

Roadmap ini berdasarkan informasi resmi yang tersedia pada Mei 2026.

Sinyal resmi:

- Google-managed MCP servers: lebih dari 50 MCP server untuk Google Cloud / Workspace, Agent Registry, IAM Deny, Model Armor, OTel Tracing, Cloud Audit Logs.
- Gemini Enterprise: Agent Platform, ADK, MCP/A2A, Agent Identity, Agent Gateway, Model Armor, Agent Observability, Memory Bank.
- Salesforce + Google Cloud deep context: Slack, Google Workspace, Salesforce, BigQuery/Lakehouse, dan zero-copy context.
- Agentic Data Cloud: AlloyDB / Cloud SQL / Spanner / Firestore / BigQuery / Knowledge Catalog / managed remote MCP servers.
- Pola MCP RequestContext: session/request context harus lokal per request dan objek stateful tidak boleh dipakai ulang lintas request.

Prioritas:

1. Integrasi Workspace MCP
   - Drive: menyimpan shortlist CSV, PDF spesifikasi, dokumen review internal.
   - Calendar: mencatat tenggat pertanyaan, pengajuan, dan pembukaan tender.
   - Gmail / Chat: mengirim radar pagi dan konfirmasi penanggung jawab.

2. Gemini / Document AI
   - Mengubah PDF spesifikasi menjadi eligibility, dokumen wajib, tenggat, dan pertanyaan ambigu.
   - Menggunakan Gemini document understanding atau Document AI Gemini layout parser.
   - Ekstraksi adalah dukungan keputusan, bukan interpretasi resmi final.

3. Agentic Data Cloud
   - BigQuery: riwayat pemenang, pola pembeli, analisis pesaing.
   - AlloyDB / Cloud SQL: kualifikasi perusahaan, model biaya, riwayat peluang internal.
   - Knowledge Catalog: semantik, akses, lineage, dan atribusi.

4. Managed MCP / Governance
   - Prioritaskan Google-managed MCP servers sebelum menambah permukaan MCP kustom.
   - Wajibkan IAM Deny, Model Armor, Cloud Audit Logs, dan OTel tracing sebelum produksi.
   - Gunakan Agent Registry untuk discovery dan batas pengelolaan.

Prinsip desain:

- Gunakan Tools / Prompts / Resources MCP standar terlebih dahulu.
- Jaga state seperti RequestContext tetap lokal per request.
- Jangan mencampur secret, OAuth token, atau data pelanggan ke output tool.
- Perlakukan PDF dan teks tender dari upstream sebagai data tidak tepercaya untuk pertahanan prompt injection.
- Biarkan data tetap di tempat asalnya; prioritaskan zero-copy dan managed connector.
