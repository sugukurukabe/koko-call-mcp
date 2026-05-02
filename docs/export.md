# CSV / JSON Export

## 日本語

入札候補をCSVまたはJSONで標準出力へ出します。Google SheetsやExcelに貼る用途を想定しています。

```bash
npx --yes jp-bids-export \
  --prefecture 鹿児島県 \
  --category 役務 \
  --query システム,保守 \
  --days 7 \
  --limit 50 \
  --format csv > bids.csv
```

JSON:

```bash
npx --yes jp-bids-export --prefecture 鹿児島県 --query システム --format json
```

## English

Export bid candidates as CSV or JSON to stdout. This is designed for Google Sheets and Excel workflows.

```bash
npx --yes jp-bids-export \
  --prefecture 鹿児島県 \
  --category 役務 \
  --query システム,保守 \
  --days 7 \
  --limit 50 \
  --format csv > bids.csv
```

JSON:

```bash
npx --yes jp-bids-export --prefecture 鹿児島県 --query システム --format json
```

## Bahasa Indonesia

Ekspor kandidat tender sebagai CSV atau JSON ke stdout. Cocok untuk Google Sheets dan Excel.

```bash
npx --yes jp-bids-export \
  --prefecture 鹿児島県 \
  --category 役務 \
  --query システム,保守 \
  --days 7 \
  --limit 50 \
  --format csv > bids.csv
```

JSON:

```bash
npx --yes jp-bids-export --prefecture 鹿児島県 --query システム --format json
```
