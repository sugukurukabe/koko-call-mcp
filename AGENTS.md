# AGENTS.md

## 日本語

このリポジトリは JP Bids MCP です。開発時は MCP公式仕様、`docs/spec-notes/`、`docs/adr/`、`.cursor/rules/` を先に確認してください。

禁止事項:

- `console.log` でstdoutへログを出すこと。
- KKJ APIへ短時間に大量アクセスすること。
- 添付PDFや取得XMLの大規模データを保存・コミットすること。
- `any` を使うこと。

## English

This repository is JP Bids MCP. Before development, read the official MCP specification, `docs/spec-notes/`, `docs/adr/`, and `.cursor/rules/`.

Do not:

- Write logs to stdout with `console.log`.
- Send high-volume bursts to the KKJ API.
- Store or commit attachment PDFs or large raw XML data.
- Use `any`.

## Bahasa Indonesia

Repositori ini adalah JP Bids MCP. Sebelum pengembangan, baca spesifikasi resmi MCP, `docs/spec-notes/`, `docs/adr/`, dan `.cursor/rules/`.

Jangan:

- Menulis log ke stdout dengan `console.log`.
- Mengirim request besar secara cepat ke API KKJ.
- Menyimpan atau commit PDF lampiran atau data XML mentah berukuran besar.
- Menggunakan `any`.
