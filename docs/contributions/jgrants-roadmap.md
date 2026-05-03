# Jグランツ MCP への貢献ロードマップ / J-Grants MCP Contribution Roadmap

対象リポジトリ：[digital-go-jp/jgrants-mcp-server](https://github.com/digital-go-jp/jgrants-mcp-server)  
Target repository: [digital-go-jp/jgrants-mcp-server](https://github.com/digital-go-jp/jgrants-mcp-server)

このドキュメントは、JP Bids MCP チームが Jグランツ MCP の OSSコードを精読して特定した改善候補をまとめたものです。
各候補を確認した上で順次PRを送る予定です。MITライセンスの遵守・既存設計の尊重を前提とします。

This document lists improvements identified by the JP Bids MCP team after reading the J-Grants MCP source.
PRs will be submitted in order, respecting the MIT license and existing design.

---

## 送信済み / Submitted

### PR #1: `get_subsidy_overview` の `accepting` カウントバグ修正

- **ファイル**: `jgrants_mcp_server/core.py` L266–L303
- **問題**: `by_deadline_period.accepting` が常に `0` のまま更新されない。`acceptance_start_datetime` と `acceptance_end_datetime` の両端チェックが実装されていない。
- **修正**: `start_date <= now <= end_date` の比較を追加して `accepting` を加算する。
- **難易度**: 低（5行以内の修正）
- **PR**: [#2](https://github.com/digital-go-jp/jgrants-mcp-server/pull/2)（マージ待ち）

### PR #2: `stateless_http=True` 対応（Cloud Run / サーバレス互換）

- **ファイル**: `jgrants_mcp_server/core.py` 末尾
- **問題**: FastMCPはデフォルトで `stateless_http=False` でStreamable HTTPを起動する。Cloud Runなどステートレス環境ではセッション復元エラーが発生する。
- **修正**: `mcp.run()` と `mcp.http_app()` に `stateless_http=True` を追加。
- **難易度**: 低（2箇所の引数追加）
- **PR**: [#3](https://github.com/digital-go-jp/jgrants-mcp-server/pull/3)（マージ待ち）

### PR #3: 公式 Dockerfile 追加

- **ファイル**: `Dockerfile` (新規), `.dockerignore` (新規)
- **問題**: Dockerイメージがなく、Cloud Run / Fly.io / Renderへのデプロイが手動になる。
- **修正**: マルチステージビルド + 非rootユーザー + `$PORT` 対応の本番用Dockerfileを追加。
- **難易度**: 低
- **PR**: [#4](https://github.com/digital-go-jp/jgrants-mcp-server/pull/4)（マージ待ち）

### PR #4: pytest 単体テスト追加

- **ファイル**: `tests/test_unit.py` (新規), `pytest.ini` (新規)
- **問題**: 現状のテストはlive API接続前提の手動smokeのみ。CIで実行可能なテストがない。
- **修正**: `_safe_path` と `get_subsidy_overview` を対象とした14件のユニットテスト。`test_accepting_count_currently_open` はPR #1のバグを証明するテスト（PR #1マージ前はFAIL、マージ後はPASS）。
- **難易度**: 中（271行）
- **PR**: [#5](https://github.com/digital-go-jp/jgrants-mcp-server/pull/5)（マージ待ち）

---

## 次回以降の候補 / Upcoming Candidates

| # | タイトル | 対象ファイル | 難易度 | 想定行数 | 優先度 |
|---|---|---|---|---|---|
| 5 | 英語版 README 翻訳 | `README.en.md` (新規) | 中 | 100行 | 中 |
| 6 | 業種・地域の Completion 実装 | `core.py` | 中 | 50行 | 中 |

---

### PR #5: 英語版 README 翻訳

**問題**: READMEが日本語のみ。海外のMCPクライアントユーザーや、Anthropic/OpenAIのマーケットプレイスレビュアーが直接参照できない。

**修正案**: `README.md` を日英両対応にするか、`README.en.md` を追加する。少なくとも Quick Start とツール一覧を英語で提供する。

---

### PR #6: 業種・地域の Completion 実装

**問題**: `search_subsidies` の `industry`（業種）パラメータと `target_area_search`（地域）パラメータは、有効な値がAPIドキュメントで定義されているが、MCPの Completion プリミティブが実装されていない。LLMが誤った値を渡すリスクがある。

**修正案**: `core.py` 内の定数リスト（`VALID_INDUSTRIES`, `VALID_AREAS`）を使って MCP Completionを実装する。

**MCP仕様の根拠**: [MCP 2025-11-25 Completion](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/completion) にて候補値を提供する仕様が定義されている。

---

---

## 方針 / Policy

- 各PRは独立した小さな変更にする（レビューしやすくするため）
- PR本文は日本語と英語を両方書く（デジタル庁リポジトリのコミュニケーション慣習に合わせる）
- 既存の設計方針（FastMCP、1ファイル構成）を尊重する
- Issues機能が無効のため、連絡はPRコメントとGitHub Discussionsで行う
- コードはMITライセンス遵守

---

*最終更新: 2026-05-04 / Last updated: 2026-05-04*
*PR送信: #2, #3, #4, #5 → digital-go-jp/jgrants-mcp-server*
