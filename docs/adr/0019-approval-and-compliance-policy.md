# ADR-0019: 書込み系ツールへの Approval Token + Compliance Check 二重ロック
# ADR-0019: Dual Lock for Write Tools — Approval Token + Compliance Check
# ADR-0019: Kunci Ganda untuk Alat Tulis — Token Persetujuan + Pemeriksaan Kepatuhan

## Status / Status / Status

Accepted / Accepted / Diterima

## Context / 背景 / Konteks

ADR-0016 で Gateway は `risk_level: financial` のサーバーを OAuth 認証 + Pro tier の組み合わせで保護することを決定した。
しかし GMO Banking MCP の `gmo_bank_transfer` は実際の資金移動を引き起こすため、認証だけでは不十分である。
以下の要件を満たすツール単位の追加ロックが必要になった:

1. LLM が誤って送金ツールを呼び出すことを防ぐ（意図しない自動実行の防止）
2. 呼び出しパラメータ（金額・口座番号）に対して人間またはエージェントが明示的に承認したことを証明する
3. コンプライアンスルール（取引上限・KYC 確認など）を拡張可能な形で抽象化する

---

ADR-0016 decided that the Gateway protects `risk_level: financial` servers with OAuth + Pro tier.
However, `gmo_bank_transfer` in GMO Banking MCP causes actual fund transfers,
making authentication alone insufficient. A per-tool additional lock is required to satisfy:

1. Prevent LLM from accidentally calling the transfer tool (prevent unintended automatic execution)
2. Prove that a human or agent explicitly approved specific call parameters (amount, account number)
3. Abstract compliance rules (transaction limits, KYC checks, etc.) in an extensible way

---

ADR-0016 memutuskan bahwa Gateway melindungi server `risk_level: financial` dengan OAuth + Pro tier.
Namun, `gmo_bank_transfer` di GMO Banking MCP menyebabkan transfer dana aktual,
membuat autentikasi saja tidak cukup. Kunci tambahan per alat diperlukan untuk memenuhi:

1. Mencegah LLM secara tidak sengaja memanggil alat transfer (mencegah eksekusi otomatis yang tidak disengaja)
2. Membuktikan bahwa manusia atau agen secara eksplisit menyetujui parameter panggilan tertentu
3. Mengabstraksi aturan kepatuhan (batas transaksi, pemeriksaan KYC, dll.) secara extensible

## Decision / 決定 / Keputusan

**`tool_policies` フィールドを registry に追加し、ツール単位で `required_approval` と `compliance_check` を設定できるようにする。**

**Add `tool_policies` field to the registry to configure `required_approval` and `compliance_check` per tool.**

**Tambahkan field `tool_policies` ke registry untuk mengonfigurasi `required_approval` dan `compliance_check` per alat.**

### required_approval の仕組み / How required_approval works / Cara kerja required_approval

```
エージェントフロー / Agent flow / Alur agen:

1. gmo_bank_get_balance → 残高確認
2. issue_approval_token → HMAC 署名付きトークン取得（引数をハッシュに含む）
3. （任意）ユーザーに最終確認
4. call_registered_mcp + approval_token → Policy Engine が verify() → 実行
```

- Approval Token は `crypto.createHmac('sha256', GATEWAY_APPROVAL_HMAC_SECRET)` で署名する
- ペイロードに `server_id`, `tool_name`, `args`, `expires_at` を含める
- TTL はデフォルト 300 秒（5 分）、最大 600 秒
- `timingSafeEqual` でタイミング攻撃を防ぐ
- 引数の JSON 正規化で一致確認（`JSON.stringify` のキー順依存はトークン発行側と検証側で同じ関数が生成するため許容する）

---

- Approval Token is signed with `crypto.createHmac('sha256', GATEWAY_APPROVAL_HMAC_SECRET)`
- Payload includes `server_id`, `tool_name`, `args`, `expires_at`
- TTL defaults to 300 seconds (5 min), max 600 seconds
- `timingSafeEqual` prevents timing attacks
- JSON normalization for argument matching (key-order dependency from `JSON.stringify` is acceptable since both issuer and verifier use the same function)

### compliance_check の仕組み / How compliance_check works / Cara kerja compliance_check

`tool_policies[toolName].compliance_check` はキー名の配列を持つ。
呼び出し側は `compliance_context: { tx_amount_under_limit: true }` のように全キーを `true` に設定して渡す責任を負う。
Policy Engine はキーが未設定または `false` であれば `denied` を返す。

`tool_policies[toolName].compliance_check` holds an array of key names.
The caller is responsible for passing all keys as `true` in `compliance_context`.
Policy Engine returns `denied` if any key is missing or `false`.

`tool_policies[toolName].compliance_check` berisi array nama kunci.
Pemanggil bertanggung jawab meneruskan semua kunci sebagai `true` di `compliance_context`.
Policy Engine mengembalikan `denied` jika ada kunci yang hilang atau `false`.

## Rationale / 理由 / Alasan

### なぜ HMAC か / Why HMAC / Mengapa HMAC

JWT は検証ライブラリ・鍵ローテーション・アルゴリズム選択の複雑さを持つ。
今回は「同一サービス内で発行・検証する使い捨てトークン」であり、HMAC-SHA256 で十分。
ライブラリ非依存で Node.js 標準 `crypto` モジュールのみを使用する。

JWT has complexity in validation libraries, key rotation, and algorithm selection.
This use case is "one-time tokens issued and verified within the same service", for which HMAC-SHA256 is sufficient.
Uses only Node.js standard `crypto` module with no external library dependencies.

JWT memiliki kompleksitas dalam pustaka validasi, rotasi kunci, dan pemilihan algoritma.
Kasus penggunaan ini adalah "token sekali pakai yang diterbitkan dan diverifikasi dalam layanan yang sama",
di mana HMAC-SHA256 sudah cukup. Menggunakan hanya modul `crypto` standar Node.js tanpa dependensi pustaka eksternal.

### なぜ TTL 5 分か / Why 5-minute TTL / Mengapa TTL 5 menit

- 短すぎ（1 分以下）: マルチエージェント処理中に期限切れになりやすい
- 長すぎ（30 分以上）: リプレイ攻撃のリスクが高まる
- 5 分: 人間が確認してから実行するのに十分な余裕であり、リプレイリスクも低い

- Too short (under 1 min): Likely to expire during multi-agent processing
- Too long (over 30 min): Increases replay attack risk
- 5 min: Sufficient time for human review before execution, with low replay risk

### なぜ compliance_check がキー名配列か / Why compliance_check is a key-name array

- 具体的なチェックロジック（残高上限計算など）は Gateway に持たせない（ドメイン知識の外部化）
- エージェントが残高を確認し、上限以下であれば `tx_amount_under_limit: true` を宣言する責任を負う
- 将来 `kyc_verified`, `dual_approval` などのキーを無限に追加できる

- Specific check logic (balance limit calculation, etc.) is not held in the Gateway (externalization of domain knowledge)
- The agent is responsible for checking balance and declaring `tx_amount_under_limit: true` if under the limit
- Future keys like `kyc_verified`, `dual_approval` can be added indefinitely

## Implementation / 実装 / Implementasi

```
gateway/src/policy/
├── approval-token.ts     ← issue() / verify() の 2 関数
└── policy-engine.ts      ← evaluate() に required_approval + compliance_check 判定を追加

gateway/src/tools/
└── issue-approval-token.ts  ← Pro tier 専用 MCP ツール

gateway/config/registry.json
└── gmo-bank.tool_policies.gmo_bank_transfer  ← required_approval: true, compliance_check: [...]
```

## Consequences / 影響 / Konsekuensi

**良い影響 / Positive / Positif:**

- LLM の意図しない資金移動を二重ロックで防止できる
- Approval Token はステートレス（DB 不要）なので Cloud Run 複数インスタンスでも動作する
- `compliance_check` は配列追加だけで拡張でき、コード変更不要

**悪い影響 / Negative / Negatif:**

- エージェントに「まず issue_approval_token を呼べ」という 2 ステップフローを要求する
  - 対策: tool の description に明確なフロー説明を含めた
- `args` の JSON 正規化がキー順依存（実害なし: 同一コードパスで生成・検証するため）

## Related ADRs / 関連 ADR / ADR Terkait

- ADR-0016: Federation Hub 設計 — `risk_level: financial` の基本保護
- ADR-0017: Dynamic Tool Surface — `tool_allowlist` / `tool_modes` による tool 絞り込み
- ADR-0020: LLM Router Fallback — ルーティング拡張

## References / 参考 / Referensi

- [gateway/src/policy/approval-token.ts](../../gateway/src/policy/approval-token.ts)
- [gateway/src/policy/policy-engine.ts](../../gateway/src/policy/policy-engine.ts)
- [gateway/src/tools/issue-approval-token.ts](../../gateway/src/tools/issue-approval-token.ts)
- [Node.js crypto.createHmac](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options)
