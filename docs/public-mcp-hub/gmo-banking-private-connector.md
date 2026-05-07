# GMO Banking Private Connector Policy
# GMO銀行系 Private Connector 方針
# Kebijakan Konektor Privat Perbankan GMO

## 結論 / Summary / Ringkasan

GMO銀行系APIは、現時点の Public MCP JP Gateway では公開提供しません。利用許諾とAPI取得が完了した後、社内利用または契約範囲内の private connector としてのみ追加します。

GMO banking APIs are not exposed in the current Public MCP JP Gateway. They may be added only as a private connector after permission and API access are obtained.

API perbankan GMO tidak diekspos di Public MCP JP Gateway saat ini. API tersebut hanya dapat ditambahkan sebagai konektor privat setelah izin dan akses API diperoleh.

---

## 公開しない理由 / Why It Is Not Public / Alasan Tidak Dipublikasikan

| 観点 / Area / Area | 方針 / Policy / Kebijakan |
|---|---|
| 利用許諾 / Permission / Izin | 社内利用または契約範囲が確認できるまで公開しない |
| 資金移動 / Fund movement / Pergerakan dana | 振込系操作は誤実行時の影響が大きい |
| 認証情報 / Credentials / Kredensial | API credential は公開Gatewayに持たせない |
| 監査 / Audit / Audit | private connector 化後も最小メタデータのみ記録する |

---

## 現在の本番状態 / Current Production State / Status Produksi Saat Ini

Public Gateway の registry には `gmo-bank` を登録していません。`/readyz` は公開 child MCP 6本（real-estate-intel は localhost のため除外）のみを返します。

The public Gateway registry does not include `gmo-bank`. `/readyz` returns only the six public child MCPs.

Registry Gateway publik tidak menyertakan `gmo-bank`. `/readyz` hanya mengembalikan enam MCP anak publik.

```text
jp-bids
jgrants
moneyforward-ca
agriops
freee
houjin-bangou
```

`gmo-bank-mcp` Cloud Run service は `ingress: internal` に制限します。外部から直接アクセスできる状態に戻してはいけません。

The `gmo-bank-mcp` Cloud Run service must stay restricted to `ingress: internal`. Do not make it directly public.

Service Cloud Run `gmo-bank-mcp` harus tetap dibatasi dengan `ingress: internal`. Jangan membuatnya dapat diakses publik secara langsung.

---

## 有効化条件 / Activation Conditions / Syarat Aktivasi

GMO Banking private connector を有効化する前に、以下をすべて満たしてください:

Before enabling the GMO Banking private connector, all of the following must be true:

Sebelum mengaktifkan konektor privat Perbankan GMO, semua syarat berikut harus terpenuhi:

1. APIの利用許諾と利用範囲が書面または公式手続きで確認済みです。
2. connector は public Gateway ではなく private Gateway または社内専用 Gateway に接続します。
3. Cloud Run は `--ingress internal` または同等の閉域設定を維持します。
4. `allUsers` / `allAuthenticatedUsers` に `roles/run.invoker` を付与しません。
5. API credential は Secret Manager で管理し、repository・記事・ログに出しません。
6. 振込系toolは `required_approval` と `compliance_check` を必須にします。
7. 監査ログは request id / actor hash / tool name / decision / latency などのメタデータに限定します。

---

## 禁止事項 / Prohibited Actions / Tindakan yang Dilarang

- `gmo-bank` を公開 `gateway/config/registry.json` に戻さないでください。
- `GATEWAY_CHILD_ENDPOINT_GMO_BANK` を公開 Gateway の Cloud Run service に設定しないでください。
- `gmo-bank-mcp` に `--allow-unauthenticated` を設定しないでください。
- GMO API credential を `.env.example`、README、記事、ADR、Cloud Logging に出さないでください。
- 利用許諾が未確認のまま、残高照会・入出金照会・振込系toolをユーザー向け機能として説明しないでください。

Do not:

- Add `gmo-bank` back to the public `gateway/config/registry.json`.
- Set `GATEWAY_CHILD_ENDPOINT_GMO_BANK` on the public Gateway Cloud Run service.
- Configure `gmo-bank-mcp` with `--allow-unauthenticated`.
- Put GMO API credentials in `.env.example`, README files, articles, ADRs, or Cloud Logging.
- Present balance, transaction, or transfer tools as user-facing features before permission is confirmed.

---

## 確認コマンド / Verification Commands / Perintah Verifikasi

```bash
gcloud run services describe gmo-bank-mcp \
  --region asia-northeast1 \
  --format='value(metadata.annotations.run.googleapis.com/ingress-status)'
```

期待値:

```text
internal
```

```bash
curl -sS -m 10 \
  https://public-mcp-jp-gateway-397249937286.asia-northeast1.run.app/readyz \
  | python3 -m json.tool
```

期待値:

```json
{
  "production_ready": true,
  "configured_server_count": 6,
  "active_server_count": 6,
  "required_endpoint_env_keys": []
}
```

---

## 関連資料 / Related Documents / Dokumen Terkait

- [`gateway/README.md`](../../gateway/README.md)
- [`docs/public-mcp-hub/status-report-2026-05-07.md`](./status-report-2026-05-07.md)
- [`docs/adr/0022-gateway-expansion-packs.md`](../adr/0022-gateway-expansion-packs.md)
- [`deploy/gmo-bank-cloud-run/server.js`](../../deploy/gmo-bank-cloud-run/server.js)
