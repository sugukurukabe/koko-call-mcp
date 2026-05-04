# Security

## 日本語

- ローカルの検索利用には秘密情報は不要です。Remote HTTP / Pro tier / OAuth / Stripe / Vertex AI / Slack ジョブを有効にする場合は、対応する環境変数を安全に管理してください。
- `.env` に値を入れる場合もcommitしないでください。
- 添付資料や取得XMLの大量保存は行いません。
- 脆弱性はGitHub Security Advisoryまたはメンテナへ非公開で報告してください。

## English

- No secrets are required for local read-only search. Remote HTTP, Pro tier, OAuth, Stripe, Vertex AI, and Slack jobs require their corresponding environment variables to be managed securely.
- Do not commit `.env` files even when local values are used.
- The server does not store attachments or bulk raw XML.
- Report vulnerabilities privately through GitHub Security Advisory or the maintainers.

## Bahasa Indonesia

- Tidak diperlukan rahasia untuk pencarian lokal hanya-baca. Remote HTTP, tier Pro, OAuth, Stripe, Vertex AI, dan job Slack memerlukan variabel lingkungan terkait yang harus dikelola dengan aman.
- Jangan commit file `.env` walaupun dipakai secara lokal.
- Server tidak menyimpan lampiran atau XML mentah dalam jumlah besar.
- Laporkan kerentanan secara privat melalui GitHub Security Advisory atau maintainer.
