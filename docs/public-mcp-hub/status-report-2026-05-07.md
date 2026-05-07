# Public MCP JP Gateway 現状報告書
# Public MCP JP Gateway Status Report
# Laporan Status Public MCP JP Gateway

作成日 / Date / Tanggal: 2026-05-07  
対象 / Scope / Cakupan: Public MCP JP Gateway, Zenn 記事, Note 記事, AgriOps 拡張, GMO銀行系APIの公開除外

---

## 1. 結論 / Summary / Ringkasan

**日本語**

Public MCP JP Gateway は、MVP 実装・AgriOps 拡張・法人番号拡張・Zenn 記事の GitHub 公開準備まで完了しています。GMO銀行系APIは公開 Gateway から外し、利用許諾とAPI取得が完了した後の private connector 予定に変更しました。

**English**

The Public MCP JP Gateway MVP, AgriOps expansion, Corporate Number expansion, and Zenn GitHub article publication setup are complete. GMO banking APIs have been removed from the public Gateway and are now documented as a future private connector after permission and API access are obtained.

**Bahasa Indonesia**

MVP Public MCP JP Gateway, perluasan AgriOps, perluasan Nomor Korporasi, dan persiapan publikasi artikel Zenn melalui GitHub telah selesai. API perbankan GMO telah dihapus dari Gateway publik dan didokumentasikan sebagai konektor privat masa depan setelah izin dan akses API diperoleh.

---

## 2. Git / 公開状態 / Git and Publication Status / Status Git dan Publikasi

| 項目 / Item / Item | 状態 / Status / Status |
|---|---|
| 現在ブランチ / Current branch / Branch saat ini | `main` |
| 最新ローカル HEAD / Latest local HEAD / HEAD lokal terbaru | `07179167` |
| origin/main / Remote main / Main remote | `07179167` |
| 最新コミット / Latest commit / Commit terbaru | `docs: Zenn記事の見出しを敬体に修正` |
| Zenn 記事（全景） / Zenn article / Artikel Zenn | `articles/public-mcp-jp-gateway.md` push 済み・公開済み |
| Zenn 記事（OAuth） / Zenn OAuth article / Artikel OAuth | `articles/mcp-gateway-oauth-passthrough.md` push 済み・公開済み |
| Zenn raw 確認 / Raw check / Pemeriksaan raw | GitHub raw で 2 本とも表示確認済み |
| Note 記事 / Note article / Artikel Note | `docs/marketing/note-gateway-article.md` commit 済み。Note への貼り付け・公開は手動 |
| 未追跡 / Untracked / Belum terlacak | `jgrants-mcp-server/` |

Zenn 記事 raw URL:

```text
https://raw.githubusercontent.com/sugukurukabe/koko-call-mcp/main/articles/public-mcp-jp-gateway.md
```

---

## 3. 完了した実装 / Completed Implementation / Implementasi yang Selesai

**日本語**

Gateway 本体は `gateway/` 配下に新規 TypeScript package として追加済みです。JP Bids MCP 本体とは分離し、child MCP を HTTP proxy で呼ぶ構成です。

**English**

The Gateway has been added as a separate TypeScript package under `gateway/`. It is separated from the JP Bids MCP core and calls child MCPs through HTTP proxying.

**Bahasa Indonesia**

Gateway telah ditambahkan sebagai paket TypeScript terpisah di bawah `gateway/`. Gateway dipisahkan dari inti JP Bids MCP dan memanggil MCP anak melalui proxy HTTP.

### 実装済み機能 / Implemented features / Fitur yang sudah diimplementasikan

| 機能 / Feature / Fitur | 状態 / Status / Status |
|---|---|
| child MCP registry | 完了 / Done / Selesai |
| `list_connected_servers` | 完了 / Done / Selesai |
| `search_public_opportunities` | 完了 / Done / Selesai |
| `analyze_funding_fit` | 完了 / Done / Selesai |
| `call_registered_mcp` | 完了 / Done / Selesai |
| `get_audit_events` | 完了 / Done / Selesai |
| `get_gateway_demo` | 完了 / Done / Selesai |
| `issue_approval_token` | 完了 / Done / Selesai |
| Approval Token | 完了 / Done / Selesai |
| Compliance check | 完了 / Done / Selesai |
| LLM router fallback | 完了 / Done / Selesai |
| Dynamic mode generalization | 完了 / Done / Selesai |
| AgriOps child MCP registry | 完了 / Done / Selesai |

---

## 4. 現在の child MCP / Current Child MCPs / MCP Anak Saat Ini

| id | 分野 / Domain / Domain | risk_level | 状態 / Status / Status |
|---|---|---|---|
| `jp-bids` | 官公需入札 / Procurement / Pengadaan | `read_only` | registry 登録済み |
| `jgrants` | 補助金 / Grants / Subsidi | `read_only` | registry 登録済み |
| `agriops` | 農業・自治体統計 / Agriculture and municipality stats / Statistik pertanian dan kota | `read_only` | registry 登録済み |
| `freee` | 会計・請求書 / Accounting and invoices / Akuntansi dan faktur | `financial` | registry 登録済み |
| `moneyforward-ca` | 会計 / Accounting / Akuntansi | `financial` | registry 登録済み |
| `houjin-bangou` | 法人番号 / Corporate Number / Nomor Korporasi | `read_only` | registry 登録済み |
| `real-estate-intel` | 不動産投資分析 / Real Estate Intel / Intelijen Real Estat | `read_only` | registry 登録済み |

注意 / Note / Catatan:

GMO銀行系APIは、現時点の公開 Gateway では提供していません。利用許諾とAPI取得が完了した後、社内利用または契約範囲内の private connector として追加する予定です。

GMO banking APIs are not exposed in the public Gateway. They are planned as a future private connector after permission and API access are obtained.

API perbankan GMO tidak diekspos di Gateway publik. API tersebut direncanakan sebagai konektor privat di masa depan setelah izin dan akses API diperoleh.

---

## 5. AgriOps 拡張 / AgriOps Expansion / Perluasan AgriOps

**日本語**

AgriOps は、現在の 7 本構成（real-estate-intel 含む）の read-only child MCP として registry に追加済みです。公開 registry では、確認済み tool の `get_municipality_stats` のみを `agri_research` / `municipality_analysis` mode に公開しています。

**English**

AgriOps has been added as a read-only child MCP in the current 6-server registry. The public registry only exposes the confirmed tool `get_municipality_stats` under `agri_research` and `municipality_analysis` modes.

**Bahasa Indonesia**

AgriOps telah ditambahkan sebagai MCP anak read-only dalam registry 6 server saat ini. Registry publik hanya mengekspos tool yang sudah dikonfirmasi, yaitu `get_municipality_stats`, pada mode `agri_research` dan `municipality_analysis`.

```json
{
  "id": "agriops",
  "risk_level": "read_only",
  "tool_modes": {
    "agri_research": ["get_municipality_stats"],
    "municipality_analysis": ["get_municipality_stats"]
  }
}
```

---

## 6. 設計ドキュメント / Design Documents / Dokumen Desain

| ファイル / File / File | 内容 / Content / Isi |
|---|---|
| `docs/adr/0016-public-mcp-federation-hub.md` | Gateway を JP Bids MCP と分離する ADR |
| `docs/adr/0017-dynamic-tool-surface.md` | mode による tool surface 制御 |
| `docs/adr/0018-cache-strategy.md` | read-only public data の cache 方針 |
| `docs/adr/0019-approval-and-compliance-policy.md` | Approval Token と compliance check |
| `docs/adr/0020-llm-router-fallback.md` | LLM fallback router |
| `docs/adr/0021-moneyforward-accounting-mcp-integration.md` | MoneyForward Cloud Accounting MCP 連携 |
| `docs/adr/0022-gateway-expansion-packs.md` | AgriOps・法人番号・e-Stat・e-Gov・SSW/Visa 拡張方針 |
| `docs/public-mcp-hub/CONTRIBUTING-child-mcp.md` | child MCP 追加手順 |
| `docs/public-mcp-hub/gmo-banking-private-connector.md` | GMO銀行系APIのprivate connector方針 |
| `docs/public-mcp-hub/expansion-registry-templates.json` | 将来 child MCP 候補テンプレート |

---

## 7. 記事の状態 / Article Status / Status Artikel

### Zenn

| 項目 / Item / Item | 状態 / Status / Status |
|---|---|
| ファイル / File / File | `articles/public-mcp-jp-gateway.md` |
| frontmatter | 設定済み / Configured / Sudah dikonfigurasi |
| `published` | `true` |
| push | 完了 / Done / Selesai |

### Zenn（第2弾: OAuth pass-through 設計）

| 項目 / Item / Item | 状態 / Status / Status |
|---|---|
| ファイル / File / File | `articles/mcp-gateway-oauth-passthrough.md` |
| frontmatter | 設定済み / Configured / Sudah dikonfigurasi |
| `published` | `true` |
| push | 完了 / Done / Selesai |

### Note

| 項目 / Item / Item | 状態 / Status / Status |
|---|---|
| ファイル / File / File | `docs/marketing/note-gateway-article.md` |
| 公開原稿 / Publication draft / Draf publikasi | 完成 / Ready / Siap |
| commit | 完了 / Done / Selesai |
| 公開 / Publish / Publikasi | Note への貼り付けと公開は手動 / Manual paste and publish on Note |

---

## 8. 検証結果 / Verification Results / Hasil Verifikasi

直近の検証結果:

```text
TypeScript: pass
Test Files: 8 passed
Tests: 56 passed
Production verification: pass
```

確認済み事項:

- `gateway/config/registry.json` に 7 本の child MCP を登録済み（うち real-estate-intel は localhost、本番デプロイ待ち）
- AgriOps は未確認 tool を公開せず、`get_municipality_stats` のみに限定
- GMO銀行系APIは公開 registry から除外済み
- `gmo-bank-mcp` は internal ingress として扱う方針を文書化済み
- 本番 `/readyz` は `production_ready: true`、公開 child MCP 6本（real-estate-intel は localhost のため除外）を確認済み
- `gateway/scripts/verify-production.ts` で公開GatewayとGMO非公開状態を自動検証可能
- Zenn 記事は GitHub raw で表示確認済み
- `.env.example` は空値のみで、秘密情報は含まれていない
- `docs/marketing/*gateway-article.md` のドラフト注記・相対リンク・画像プレースホルダーは除去済み

---

## 9. 未完了・注意点 / Pending Items and Risks / Item Tertunda dan Risiko

| 項目 / Item / Item | 状態 / Status / Status | 次アクション / Next action / Tindakan berikutnya |
|---|---|---|---|
| Note 公開 | 手動待ち | `docs/marketing/note-gateway-article.md` を Note に貼り付けて公開 |
| Note/Zenn 相互リンク | Note 公開後 | 両方の公開 URL 確定後に追記 |
| GMO Banking private connector | 将来予定 | 利用許諾とAPI取得後に private connector として追加。方針書は `docs/public-mcp-hub/gmo-banking-private-connector.md` |
| AgriOps 本番 endpoint | 完了 | `GATEWAY_CHILD_ENDPOINT_AGRIOPS` を本番に設定済み |
| Zenn 全景記事 | 完了 | `articles/public-mcp-jp-gateway.md` push 済み |
| Zenn OAuth 記事 | 完了 | `articles/mcp-gateway-oauth-passthrough.md` push 済み |
| 本番検証コマンド | 完了 | `npm run verify:production` で公開6本とGMO非公開を自動検証 |
| `jgrants-mcp-server/` | 未追跡 | 別作業か不要ファイルか判断 |

---

## 10. 次に実施すること / Next Steps / Langkah Berikutnya

1. Note に `docs/marketing/note-gateway-article.md` を貼り付けて公開します。
2. 公開済み URL を Zenn 2 本と Note に相互リンクとして追記します。
3. 設定変更後は `cd gateway && npm run verify:production` で確認します。
4. GMO Banking private connector は、利用許諾とAPI取得後に別途設計・追加します。

---

## 11. 現時点の判断 / Current Assessment / Penilaian Saat Ini

**日本語**

技術実装、設計資料、Zenn 記事 2 本の公開、本番検証コマンド、GMO 銀行系 API の公開除外は完了です。不動産インテル MCP（10 都道府県、地価・投資分析）を 7 本目の child MCP として registry に追加しました。残りは「Note 公開」「不動産 MCP の本番デプロイ」「相互リンク更新」です。

**English**

The technical implementation, design documentation, two Zenn articles, production verification command, and GMO banking API public-surface removal are complete. Real Estate Intel MCP (10 prefectures, land price and investment analysis) has been added as the 7th child MCP. Remaining work: Note publication, Real Estate Intel production deployment, and cross-link updates.

**Bahasa Indonesia**

Implementasi teknis, dokumentasi desain, dua artikel Zenn, perintah verifikasi produksi, dan penghapusan API perbankan GMO dari permukaan publik sudah selesai. MCP Intelijen Real Estat (10 prefektur, harga tanah dan analisis investasi) telah ditambahkan sebagai MCP anak ke-7. Sisa pekerjaan: publikasi Note, deployment produksi Real Estate Intel, dan pembaruan tautan silang.
