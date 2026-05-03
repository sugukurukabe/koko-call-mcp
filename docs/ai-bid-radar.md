# AI Bid Radar

## 日本語

AI Bid Radar は、入札情報を「検索結果」ではなく「追うべき候補」に変えるためのMVPです。

最初のtool:

- `rank_bids`
- `explain_bid_fit`
- `assess_bid_qualification`
- `extract_bid_requirements`
- `export_bid_shortlist`
- `create_bid_calendar`
- `create_bid_review_packet`
- `draft_bid_questions`
- `analyze_past_awards`

何をするか:

- 官公需情報ポータルサイトAPIで入札を検索します。
- 期限、公式URL、発注機関、地域、カテゴリ、キーワード一致、手続種別をもとにスコアリングします。
- `pursue`、`review`、`skip` の優先度と、理由、リスク、次アクションを返します。
- 1件の `bid_key` について、社内検討で確認すべきチェックリストを返します。
- 自社の対応地域、カテゴリ、資格、サービスキーワードと照合し、参加できそうかをMVP判定します。
- PDF本文を保存せず、既知の要件、添付資料、Document AI/Geminiに渡すべき対象を整理します。
- Google Sheets / Excelに貼れる社内検討CSVを返します。
- Google Calendar / Outlookに取り込めるICSを返し、検索結果に無い質問期限は捏造せず要確認にします。
- 判断理由、要件、期限、確認資料、次アクションを1つのMarkdown社内検討メモにまとめます。
- 不足情報から発注者へ確認する質問書ドラフトを返します。
- 過去公告を集計し、発注機関の頻度、カテゴリ・手続種別の偏り、月次トレンドから競合・発注パターンを推定します。

注意:

- 現時点ではルールベースの候補整理です。
- 参加可否や落札可能性の最終判断ではありません。
- 全省庁統一資格、自治体資格、過去落札、原価は次の拡張で接続します。

## English

AI Bid Radar is an MVP for turning bid search results into candidates worth following up.

First tool:

- `rank_bids`
- `explain_bid_fit`
- `assess_bid_qualification`
- `extract_bid_requirements`
- `export_bid_shortlist`
- `create_bid_calendar`
- `create_bid_review_packet`
- `draft_bid_questions`
- `analyze_past_awards`

What it does:

- Searches bids through the KKJ portal API.
- Scores candidates using deadline, official URL availability, organization, region, category, keyword fit, and procedure type.
- Returns `pursue`, `review`, or `skip` priority with reasons, risks, and next actions.
- Explains a single `bid_key` with a confirmation checklist for internal review.
- Assesses fit against company regions, categories, qualifications, and service keywords.
- Organizes known requirements, document targets, and future Document AI/Gemini inputs without storing PDF text.
- Returns internal-review CSV for Google Sheets / Excel.
- Returns ICS for Google Calendar / Outlook and marks missing question deadlines as requiring official confirmation.
- Combines rationale, requirements, deadlines, documents, and next actions into one Markdown internal-review memo.
- Returns draft clarification questions for the buyer from missing information.
- Aggregates past notices to estimate buyer frequency, category and procedure bias, and monthly trends as a competitor radar.

Notes:

- The current implementation is rules-based candidate triage.
- It is not a final eligibility or win-probability decision.
- Unified government qualification, local qualification, past awards, and cost data are planned as next integrations.

## Bahasa Indonesia

AI Bid Radar adalah MVP untuk mengubah hasil pencarian tender menjadi kandidat yang layak ditindaklanjuti.

Tool pertama:

- `rank_bids`
- `explain_bid_fit`
- `assess_bid_qualification`
- `extract_bid_requirements`
- `export_bid_shortlist`
- `create_bid_calendar`
- `create_bid_review_packet`
- `draft_bid_questions`
- `analyze_past_awards`

Apa yang dilakukan:

- Mencari tender melalui API portal KKJ.
- Memberi skor berdasarkan tenggat, URL resmi, instansi, wilayah, kategori, kecocokan kata kunci, dan jenis prosedur.
- Mengembalikan prioritas `pursue`, `review`, atau `skip` beserta alasan, risiko, dan aksi berikutnya.
- Menjelaskan satu `bid_key` dengan checklist konfirmasi untuk review internal.
- Menilai kecocokan dengan wilayah, kategori, kualifikasi, dan kata kunci layanan perusahaan.
- Mengorganisasi requirement yang diketahui, target dokumen, dan input Document AI/Gemini berikutnya tanpa menyimpan teks PDF.
- Mengembalikan CSV review internal untuk Google Sheets / Excel.
- Mengembalikan ICS untuk Google Calendar / Outlook dan menandai tenggat pertanyaan yang hilang sebagai perlu konfirmasi resmi.
- Menggabungkan alasan, requirement, tenggat, dokumen, dan aksi berikutnya ke satu memo review internal Markdown.
- Mengembalikan draft pertanyaan klarifikasi kepada pembeli dari informasi yang belum lengkap.
- Mengagregasi pengumuman tender lampau untuk memperkirakan frekuensi instansi, bias kategori dan prosedur, serta tren bulanan sebagai radar pesaing.

Catatan:

- Implementasi saat ini adalah triase kandidat berbasis aturan.
- Ini bukan keputusan akhir kelayakan atau peluang menang.
- Kualifikasi pemerintah terpadu, kualifikasi lokal, riwayat pemenang, dan data biaya direncanakan untuk integrasi berikutnya.
