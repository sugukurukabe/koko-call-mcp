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
| 最新ローカル HEAD / Latest local HEAD / HEAD lokal terbaru | `f0e74914` |
| origin/main / Remote main / Main remote | `f0e74914bd2c` |
| 最新コミット / Latest commit / Commit terbaru | `docs: Public MCP GatewayのZenn記事を追加` |
| Zenn 記事 / Zenn article / Artikel Zenn | `articles/public-mcp-jp-gateway.md` を push 済み |
| Zenn raw 確認 / Raw check / Pemeriksaan raw | GitHub raw で表示確認済み |
| Note 記事 / Note article / Artikel Note | `docs/marketing/note-gateway-article.md` 作成済み、未コミット |
| 未追跡 / Untracked / Belum terlacak | `docs/marketing/note-gateway-article.md`, `docs/marketing/zenn-gateway-article.md`, `jgrants-mcp-server/` |

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

注意 / Note / Catatan:

GMO銀行系APIは、現時点の公開 Gateway では提供していません。利用許諾とAPI取得が完了した後、社内利用または契約範囲内の private connector として追加する予定です。

GMO banking APIs are not exposed in the public Gateway. They are planned as a future private connector after permission and API access are obtained.

API perbankan GMO tidak diekspos di Gateway publik. API tersebut direncanakan sebagai konektor privat di masa depan setelah izin dan akses API diperoleh.

---

## 5. AgriOps 拡張 / AgriOps Expansion / Perluasan AgriOps

**日本語**

AgriOps は、現在の 6 本構成の中の read-only child MCP として registry に追加済みです。公開 registry では、確認済み tool の `get_municipality_stats` のみを `agri_research` / `municipality_analysis` mode に公開しています。

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
| commit | `f0e74914` |

### Note

| 項目 / Item / Item | 状態 / Status / Status |
|---|---|
| ファイル / File / File | `docs/marketing/note-gateway-article.md` |
| 公開原稿 / Publication draft / Draf publikasi | 完成 / Ready / Siap |
| commit | 未実施 / Not committed / Belum di-commit |
| 公開 / Publish / Publikasi | 未実施 / Not published / Belum dipublikasikan |

---

## 8. 検証結果 / Verification Results / Hasil Verifikasi

直近の検証結果:

```text
TypeScript: pass
Test Files: 7 passed
Tests: 52 passed
```

確認済み事項:

- `gateway/config/registry.json` に 6 本の公開 child MCP を登録済み
- AgriOps は未確認 tool を公開せず、`get_municipality_stats` のみに限定
- GMO銀行系APIは公開 registry から除外済み
- Zenn 記事は GitHub raw で表示確認済み
- `.env.example` は空値のみで、秘密情報は含まれていない
- `docs/marketing/*gateway-article.md` のドラフト注記・相対リンク・画像プレースホルダーは除去済み

---

## 9. 未完了・注意点 / Pending Items and Risks / Item Tertunda dan Risiko

| 項目 / Item / Item | 状態 / Status / Status | 次アクション / Next action / Tindakan berikutnya |
|---|---|---|---|
| Note 公開 | 未完了 | `docs/marketing/note-gateway-article.md` を note に貼り付けて公開 |
| Note/Zenn 相互リンク | 未完了 | 両方の公開 URL 確定後に追記 |
| GMO Banking private connector | 将来予定 | 利用許諾とAPI取得後に private connector として追加 |
| AgriOps 本番 endpoint | 完了 | `GATEWAY_CHILD_ENDPOINT_AGRIOPS` を本番に設定済み |
| Zenn GitHub 連携反映 | GitHub push 済み | Zenn 側で同期・公開状態を確認 |
| `jgrants-mcp-server/` | 未追跡 | 別作業か不要ファイルか判断 |
| `docs/marketing/zenn-gateway-article.md` | 未追跡 | 作業用原稿として残すか削除/commit 判断 |

---

## 10. 次に実施すること / Next Steps / Langkah Berikutnya

1. Zenn 管理画面で `articles/public-mcp-jp-gateway.md` が同期・公開されているか確認します。
2. Note 記事を公開します。
3. 公開済み URL を双方の記事末尾に追記します。
4. 本番 Gateway で `list_connected_servers(mode: "agri_research")` と `list_connected_servers(mode: "financial_check")` を確認します。
5. GMO Banking private connector は、利用許諾とAPI取得後に別途設計・追加します。

---

## 11. 現時点の判断 / Current Assessment / Penilaian Saat Ini

**日本語**

技術実装、設計資料、Zenn 公開準備、GMO銀行系APIの公開除外は完了です。残りは「Note 公開」と、公開後の相互リンク更新です。

**English**

The technical implementation, design documentation, Zenn publication setup, and GMO banking API public-surface removal are complete. Remaining work is Note publication and cross-link updates after publication.

**Bahasa Indonesia**

Implementasi teknis, dokumentasi desain, persiapan publikasi Zenn, dan penghapusan API perbankan GMO dari permukaan publik sudah selesai. Sisa pekerjaan adalah publikasi Note dan pembaruan tautan silang setelah publikasi.
