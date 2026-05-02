# Slack Briefing

## 日本語

Slack Bot tokenで、条件に合う入札候補をSlackへ投稿します。まずdry-runで確認してください。

必要なSlack scope:

- `chat:write`

環境変数:

```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C0123456789
JP_BIDS_BRIEFING_PREFECTURES=鹿児島県
JP_BIDS_BRIEFING_CATEGORY=役務
JP_BIDS_BRIEFING_QUERIES=システム,保守,クラウド,AI
JP_BIDS_BRIEFING_DAYS=7
JP_BIDS_BRIEFING_LIMIT=10
```

dry-run:

```bash
JP_BIDS_SLACK_DRY_RUN=1 npm run slack:briefing
```

npm packageから直接実行:

```bash
JP_BIDS_SLACK_DRY_RUN=1 npx --yes jp-bids-slack-briefing
```

投稿:

```bash
npm run slack:briefing
```

## English

Post matching public procurement candidates to Slack with a Slack bot token. Start with dry-run.

Required Slack scope:

- `chat:write`

Environment variables:

```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C0123456789
JP_BIDS_BRIEFING_PREFECTURES=鹿児島県
JP_BIDS_BRIEFING_CATEGORY=役務
JP_BIDS_BRIEFING_QUERIES=システム,保守,クラウド,AI
JP_BIDS_BRIEFING_DAYS=7
JP_BIDS_BRIEFING_LIMIT=10
```

Dry-run:

```bash
JP_BIDS_SLACK_DRY_RUN=1 npm run slack:briefing
```

Run directly from the npm package:

```bash
JP_BIDS_SLACK_DRY_RUN=1 npx --yes jp-bids-slack-briefing
```

Post:

```bash
npm run slack:briefing
```

## Bahasa Indonesia

Kirim kandidat tender publik yang cocok ke Slack memakai Slack bot token. Mulai dengan dry-run.

Scope Slack yang diperlukan:

- `chat:write`

Environment variable:

```bash
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C0123456789
JP_BIDS_BRIEFING_PREFECTURES=鹿児島県
JP_BIDS_BRIEFING_CATEGORY=役務
JP_BIDS_BRIEFING_QUERIES=システム,保守,クラウド,AI
JP_BIDS_BRIEFING_DAYS=7
JP_BIDS_BRIEFING_LIMIT=10
```

Dry-run:

```bash
JP_BIDS_SLACK_DRY_RUN=1 npm run slack:briefing
```

Jalankan langsung dari package npm:

```bash
JP_BIDS_SLACK_DRY_RUN=1 npx --yes jp-bids-slack-briefing
```

Kirim:

```bash
npm run slack:briefing
```
