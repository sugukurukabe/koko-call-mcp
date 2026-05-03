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
- **状態**: PR送信済み（マージ待ち）

---

## 次回以降の候補 / Upcoming Candidates

| # | タイトル | 対象ファイル | 難易度 | 想定行数 | 優先度 |
|---|---|---|---|---|---|
| 2 | `stateless_http=True` 対応（Cloud Run / サーバレス互換） | `core.py` | 低 | 1行 | 高 |
| 3 | 公式 Dockerfile 追加 | `Dockerfile` (新規) | 低 | 15行 | 高 |
| 4 | 英語版 README 翻訳 | `README.en.md` (新規) | 中 | 100行 | 中 |
| 5 | 業種・地域の Completion 実装 | `core.py` | 中 | 50行 | 中 |
| 6 | pytest 単体テスト追加 | `tests/` (新規) | 中 | 80行 | 中 |

---

### PR #2: `stateless_http=True` 対応

**問題**: FastMCPは `stateless_http=False`（デフォルト）でStreamable HTTPを起動する。Cloud RunやFly.ioなどのステートレス環境では、リクエストごとにプロセスが異なる可能性があるため、セッション状態を保持しないモードで動かすべき。

**修正案**:

```python
# core.py の末尾
if __name__ == "__main__":
    mcp.run(transport="streamable-http", stateless_http=True)
```

**MCP仕様の根拠**: [MCP 2025-11-25 Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#streamable-http) では `stateless_http` モードが規定されており、サーバレス環境向けに推奨される。

---

### PR #3: 公式 Dockerfile 追加

**問題**: 現在インストール手段は `git clone → pip install -e .` のみ。Dockerイメージがないため、Cloud Run・Fly.io・Renderへのデプロイが手動になる。

**修正案** (`Dockerfile` 新規):

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
RUN pip install --no-cache-dir .
COPY jgrants_mcp_server/ ./jgrants_mcp_server/
ENV PORT=8080
CMD ["python", "-m", "jgrants_mcp_server.core"]
```

---

### PR #4: 英語版 README 翻訳

**問題**: READMEが日本語のみ。海外のMCPクライアントユーザーや、Anthropic/OpenAIのマーケットプレイスレビュアーが直接参照できない。

**修正案**: `README.md` を日英両対応にするか、`README.en.md` を追加する。少なくとも Quick Start とツール一覧を英語で提供する。

---

### PR #5: 業種・地域の Completion 実装

**問題**: `search_subsidies` の `industry`（業種）パラメータと `target_area_search`（地域）パラメータは、有効な値がAPIドキュメントで定義されているが、MCPの Completion プリミティブが実装されていない。LLMが誤った値を渡すリスクがある。

**修正案**: `core.py` 内の定数リスト（`VALID_INDUSTRIES`, `VALID_AREAS`）を使って MCP Completionを実装する。

**MCP仕様の根拠**: [MCP 2025-11-25 Completion](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/completion) にて候補値を提供する仕様が定義されている。

---

### PR #6: pytest 単体テスト追加

**問題**: 現状のテストは live API接続を前提とした手動smokeテストのみ（`test_mcp.sh`）。CI上で繰り返し実行できる独立したテストがない。

**修正案**: `tests/` ディレクトリを作成し、`httpx.AsyncClient` をモックした単体テストを追加する。

対象：
- `_search_subsidies_internal` のパラメータバリデーション
- `get_subsidy_overview` の統計計算ロジック（修正済みの `accepting` カウントを含む）
- `_safe_path` のパストラバーサル防止

---

## 方針 / Policy

- 各PRは独立した小さな変更にする（レビューしやすくするため）
- PR本文は日本語と英語を両方書く（デジタル庁リポジトリのコミュニケーション慣習に合わせる）
- 既存の設計方針（FastMCP、1ファイル構成）を尊重する
- Issues機能が無効のため、連絡はPRコメントとGitHub Discussionsで行う
- コードはMITライセンス遵守

---

*最終更新: 2026-05-04 / Last updated: 2026-05-04*
