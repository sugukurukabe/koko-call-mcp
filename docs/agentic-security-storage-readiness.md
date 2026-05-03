# Agentic Security & Storage Readiness

## 日本語

AI Bid Radar が入札PDF、CSV、社内検討資料、将来のCRM/Workspace連携を扱うには、検索機能だけでなく、agent-ready storage と agentic security の設計が必要になる。

このreadiness noteは、2026年5月時点のGoogle Cloud公式発表に基づく。

公式情報:

- Cloud Storage Rapid / Smart Storage: AI workload向け高性能object storage、object context、automated annotations、Cloud Storage MCP server。
- Storage Intelligence: zero-configuration dashboards、activity tables、batch operations、Data Security Posture Management連携。
- Gemini Enterprise Agent Platform: ADK、graph-based multi-agent、Agent Runtime、Memory Bank、Agent Sessions、Agent Gateway、Agent Identity、Model Armor、Agent Simulation、Agent Observability。
- Google Cloud Fraud Defense: agentic activity measurement、agentic policy engine、AI-resistant challenge、agent/human identityのリスク管理。
- Multicloud / multi-AI security: Agent Gateway、Model Armor、Agent Identityを中心に、agentとdataの境界を管理する。
- Partner-built agents: Agent Gallery / Marketplaceで、業界特化agentをIT承認フロー付きで導入する。
- Next '26 codelabs: ADK + A2UI、multi-agent、AlloyDB NL2SQL、secure agents、Maps grounding、Cloud Run production化が実装学習パス。

AI Bid Radarへの適用:

1. 入札PDFと添付資料
   - Cloud Storageへ保存する場合は、object contextとautomated annotationsで、PDFの内容、機密性、出典、処理状態をmetadata化する。
   - Storage MCP serverは、PDFを直接tool outputへ流すのではなく、権限付きresourceとして扱うための候補にする。

2. Smart shortlist
   - `export_bid_shortlist` のCSVはDrive/Sheets向けに出すが、将来はCloud Storage + object metadataで履歴管理する。
   - Storage Intelligenceで大量CSV/PDFのコスト、アクセス、異常、権限を監視する。

3. Agent security
   - Agent Identityで、AI Bid Radar agentの操作主体を追跡できるようにする。
   - Agent Gatewayで、Workspace、BigQuery、Storage、CRMへのtool accessをポリシー制御する。
   - Model Armorで、公告文/PDFからのindirect prompt injectionとdata exfiltrationを防ぐ。

4. Fraud / trust boundary
   - public webや外部フォームにagentがアクセスする段階では、Fraud Defenseのagentic activity measurementとpolicy engineを検討する。
   - 自動提出や代理申請はMVPでは行わない。human-in-the-loopと公式確認を必須にする。

5. Partner agents
   - Salesforce / ServiceNow / Atlassian / Workday / D&B / Neo4j / S&P Globalなどのpartner agentsは、最初から独自実装しない。
   - Gemini Enterprise Agent Galleryで承認済みagentを使える場合は、AI Bid RadarからA2A/MCPで連携する設計を優先する。

実装順:

1. `docs://agentic-security-storage-readiness` をMCP Resourceとして公開する。
2. PDF要件抽出toolは、ephemeral処理から始め、storage保存は明示オプションにする。
3. Cloud Storage保存を入れる場合、object metadataに `source`, `bid_key`, `retention`, `classification`, `processed_at` を必須化する。
4. Cloud Run remoteでは、Cloud Audit Logs / OTel tracing / Model Armor導入を本番条件にする。
5. 長期workflowはGemini Enterprise Agent Platform / ADK / Agent Runtimeへ移行候補として扱う。

## English

AI Bid Radar needs agent-ready storage and agentic security before it handles bid PDFs, CSVs, internal review files, and future CRM/Workspace integrations at scale.

This readiness note is based on official Google Cloud announcements available as of May 2026.

Official signals:

- Cloud Storage Rapid / Smart Storage: high-performance object storage for AI workloads, object context, automated annotations, Cloud Storage MCP server.
- Storage Intelligence: zero-configuration dashboards, activity tables, batch operations, and Data Security Posture Management integration.
- Gemini Enterprise Agent Platform: ADK, graph-based multi-agent systems, Agent Runtime, Memory Bank, Agent Sessions, Agent Gateway, Agent Identity, Model Armor, Agent Simulation, Agent Observability.
- Google Cloud Fraud Defense: agentic activity measurement, agentic policy engine, AI-resistant challenge, and agent/human identity risk management.
- Multicloud / multi-AI security: use Agent Gateway, Model Armor, and Agent Identity to govern agent-data boundaries.
- Partner-built agents: Agent Gallery / Marketplace brings specialized agents through IT approval flows.
- Next '26 codelabs: ADK + A2UI, multi-agent systems, AlloyDB NL2SQL, secure agents, Maps grounding, and Cloud Run productionization.

Application to AI Bid Radar:

1. Bid PDFs and attachments
   - If stored in Cloud Storage, use object context and automated annotations for content, sensitivity, attribution, and processing state.
   - Treat the Storage MCP server as a candidate for permissioned resources instead of dumping PDFs into tool output.

2. Smart shortlist
   - `export_bid_shortlist` currently produces Drive/Sheets-friendly CSV. Future storage should use Cloud Storage plus object metadata for history.
   - Use Storage Intelligence to monitor cost, access, anomalies, and permissions across many CSV/PDF objects.

3. Agent security
   - Use Agent Identity to make AI Bid Radar actions traceable.
   - Use Agent Gateway to enforce policy across Workspace, BigQuery, Storage, and CRM tools.
   - Use Model Armor against indirect prompt injection and data exfiltration from bid text and PDFs.

4. Fraud / trust boundary
   - For public web or external form access, evaluate Fraud Defense agentic activity measurement and policy engine.
   - Do not automate bid submissions in the MVP. Keep human-in-the-loop and official verification mandatory.

5. Partner agents
   - Do not rebuild Salesforce / ServiceNow / Atlassian / Workday / D&B / Neo4j / S&P Global-style agents from scratch.
   - Prefer approved Gemini Enterprise Agent Gallery agents where available, connected through A2A/MCP.

Implementation order:

1. Publish `docs://agentic-security-storage-readiness` as an MCP Resource.
2. Start PDF requirement extraction as ephemeral processing; make storage opt-in.
3. If Cloud Storage is added, require object metadata: `source`, `bid_key`, `retention`, `classification`, `processed_at`.
4. For Cloud Run remote, require Cloud Audit Logs, OTel tracing, and Model Armor before production.
5. Treat long-running workflows as candidates for Gemini Enterprise Agent Platform / ADK / Agent Runtime.

## Bahasa Indonesia

AI Bid Radar membutuhkan storage yang siap untuk agent dan keamanan agentic sebelum menangani PDF tender, CSV, file review internal, serta integrasi CRM/Workspace di skala besar.

Catatan readiness ini berdasarkan pengumuman resmi Google Cloud yang tersedia pada Mei 2026.

Sinyal resmi:

- Cloud Storage Rapid / Smart Storage: object storage performa tinggi untuk workload AI, object context, automated annotations, Cloud Storage MCP server.
- Storage Intelligence: zero-configuration dashboards, activity tables, batch operations, dan integrasi Data Security Posture Management.
- Gemini Enterprise Agent Platform: ADK, graph-based multi-agent, Agent Runtime, Memory Bank, Agent Sessions, Agent Gateway, Agent Identity, Model Armor, Agent Simulation, Agent Observability.
- Google Cloud Fraud Defense: agentic activity measurement, agentic policy engine, AI-resistant challenge, dan manajemen risiko identitas agent/manusia.
- Keamanan multicloud / multi-AI: gunakan Agent Gateway, Model Armor, dan Agent Identity untuk mengelola batas agent-data.
- Partner-built agents: Agent Gallery / Marketplace menghadirkan agent khusus melalui alur persetujuan IT.
- Next '26 codelabs: ADK + A2UI, multi-agent, AlloyDB NL2SQL, secure agents, Maps grounding, dan produksi Cloud Run.

Penerapan untuk AI Bid Radar:

1. PDF tender dan lampiran
   - Jika disimpan di Cloud Storage, gunakan object context dan automated annotations untuk konten, sensitivitas, atribusi, dan status pemrosesan.
   - Storage MCP server menjadi kandidat resource berizin, bukan untuk membuang PDF langsung ke output tool.

2. Smart shortlist
   - `export_bid_shortlist` saat ini menghasilkan CSV ramah Drive/Sheets. Ke depan, riwayat dapat dikelola dengan Cloud Storage dan object metadata.
   - Gunakan Storage Intelligence untuk memantau biaya, akses, anomali, dan permission pada banyak objek CSV/PDF.

3. Keamanan agent
   - Gunakan Agent Identity agar aksi AI Bid Radar dapat ditelusuri.
   - Gunakan Agent Gateway untuk menegakkan policy pada tool Workspace, BigQuery, Storage, dan CRM.
   - Gunakan Model Armor untuk menghadapi indirect prompt injection dan data exfiltration dari teks tender dan PDF.

4. Fraud / batas trust
   - Untuk akses public web atau form eksternal, evaluasi Fraud Defense agentic activity measurement dan policy engine.
   - Jangan otomatisasi pengajuan tender pada MVP. Human-in-the-loop dan verifikasi resmi wajib.

5. Partner agents
   - Jangan membangun ulang agent seperti Salesforce / ServiceNow / Atlassian / Workday / D&B / Neo4j / S&P Global dari nol.
   - Prioritaskan agent yang sudah disetujui di Gemini Enterprise Agent Gallery jika tersedia, melalui A2A/MCP.

Urutan implementasi:

1. Publikasikan `docs://agentic-security-storage-readiness` sebagai MCP Resource.
2. Mulai ekstraksi requirement PDF sebagai pemrosesan ephemeral; storage harus opt-in.
3. Jika Cloud Storage ditambahkan, wajibkan metadata objek: `source`, `bid_key`, `retention`, `classification`, `processed_at`.
4. Untuk Cloud Run remote, wajibkan Cloud Audit Logs, OTel tracing, dan Model Armor sebelum produksi.
5. Workflow jangka panjang menjadi kandidat Gemini Enterprise Agent Platform / ADK / Agent Runtime.
