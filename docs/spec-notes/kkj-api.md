# KKJ API 仕様読み取りメモ / KKJ API Notes / Catatan API KKJ

## 日本語

- 対象は中小企業庁 官公需情報ポータルサイト検索API。エンドポイントは `http://www.kkj.go.jp/api/`、認証なし、XMLレスポンス。
- `Query`, `Project_Name`, `Organization_Name`, `LG_Code` のいずれか1つ以上が必須。複数条件はAPI側でAND結合される。
- `Count` は最大1,000。API側にページングはないため、大量検索は期間・都道府県・カテゴリで絞る。
- 期間は `YYYY-MM-DD/YYYY-MM-DD`, `YYYY-MM-DD/`, `/YYYY-MM-DD`, `YYYY-MM-DD` の形式を使う。
- `LgCode`, `PrefectureName`, `CityCode`, `CityName`, `Attachments` などは欠損し得るため、正規化層では optional として扱う。
- HTTPS非対応のため、MCPサーバーがHTTPアクセスを内部に閉じ、ユーザーへはHTTPSのMCP endpointを提供する。

## English

- The source is the Small and Medium Enterprise Agency KKJ procurement search API. Endpoint: `http://www.kkj.go.jp/api/`; no authentication; XML response.
- At least one of `Query`, `Project_Name`, `Organization_Name`, or `LG_Code` is required. Multiple conditions are ANDed by the API.
- `Count` is capped at 1,000. The API has no native pagination, so large searches must be narrowed by date, prefecture, or category.
- Date ranges use `YYYY-MM-DD/YYYY-MM-DD`, `YYYY-MM-DD/`, `/YYYY-MM-DD`, or `YYYY-MM-DD`.
- Fields such as `LgCode`, `PrefectureName`, `CityCode`, `CityName`, and `Attachments` may be missing and are modeled as optional.
- Because the upstream endpoint is HTTP-only, the MCP server keeps that access server-side and exposes an HTTPS MCP endpoint to users.

## Bahasa Indonesia

- Sumber data adalah API pencarian pengadaan pemerintah dari Small and Medium Enterprise Agency. Endpoint: `http://www.kkj.go.jp/api/`; tanpa autentikasi; respons XML.
- Minimal salah satu dari `Query`, `Project_Name`, `Organization_Name`, atau `LG_Code` wajib ada. Beberapa kondisi digabung sebagai AND oleh API.
- `Count` maksimal 1.000. API tidak memiliki pagination bawaan, sehingga pencarian besar harus dipersempit dengan tanggal, prefektur, atau kategori.
- Rentang tanggal memakai format `YYYY-MM-DD/YYYY-MM-DD`, `YYYY-MM-DD/`, `/YYYY-MM-DD`, atau `YYYY-MM-DD`.
- Field seperti `LgCode`, `PrefectureName`, `CityCode`, `CityName`, dan `Attachments` bisa kosong, sehingga dimodelkan sebagai optional.
- Karena upstream hanya HTTP, server MCP membatasi akses tersebut di sisi server dan menyediakan endpoint MCP HTTPS kepada pengguna.
