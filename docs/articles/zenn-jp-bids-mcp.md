# 日本の官公需入札APIをMCP化した

小さなJSONファイルが、入口になる時代になった。

`server.json` には、名前とバージョンと、どこから起動できるかが書いてある。以前なら、それはただのメタデータだった。いまは違う。AIエージェントがそのファイルを読み、どのサーバーへ接続し、どの道具を使うかを決める。

JP Bids MCP は、日本の官公需情報ポータルサイト検索APIをMCPから使えるようにした読み取り専用サーバーである。

```text
Remote MCP: https://mcp.bid-jp.com/mcp
npm:        jp-bids-mcp
Registry:   io.github.sugukurukabe/jp-bids
```

## 何を作ったか

日本の公共調達情報を、MCPクライアントから検索できるようにした。

実装したのは、単なるAPI wrapperではない。MCPのprimitiveを分けている。

- Tools: 検索、直近一覧、詳細取得、発注機関別集計
- Resources: 出典、API参照、都道府県コード
- Resource Templates: `bid://{bid_key}`, `prefecture://{lg_code}`, `org://{organization_name}`
- Prompts: 朝の入札確認、発注機関分析、締切確認
- Completion: 都道府県コードや直近 `bid_key` の補完
- Remote: Streamable HTTP on Cloud Run
- Package: npm + MCP Registry

## なぜToolsだけにしなかったか

多くのMCP serverはToolsだけで終わる。

でも公共データでは、アクションだけでは足りない。モデルに必要なのは、操作だけでなく、出典と文脈である。

そのため、JP Bids MCPでは `attribution://kkj` をResourceとして返し、Toolの構造化出力にも出典を含めた。モデルが「どこから来たデータか」を失わないようにするためである。

## Resource Template

巨大な検索結果を一度にモデルへ渡すのではなく、必要なものだけをURIで取りに行く。

```text
bid://{bid_key}
prefecture://{lg_code}
org://{organization_name}
```

この形にすると、クライアントは必要な文脈だけを読むことができる。MCPでは、これは小さな差に見える。しかし長く運用すると、この差が信頼性になる。

## 何を入れなかったか

Tasks、Sampling、OAuthはまだ入れていない。

理由は単純で、今の検索は短時間で終わり、公開APIの読み取りだけで成立するからである。見栄えのためにprimitiveを増やすと、サーバーはすぐに説明できないものになる。

必要になった時点でADRを書く。必要になるまでは入れない。

## 公開したもの

- GitHub
- npm
- MCP Registry
- Cloud Run remote endpoint
- SBOM
- CodeQL
- Scorecard
- Reproducible build check

```bash
npx --yes jp-bids-mcp --version
```

remote endpoint:

```text
https://mcp.bid-jp.com/mcp
```

## 終わりに

公共情報は公開されている。

しかし、公開されていることと、AIエージェントが正しく使えることは違う。

MCP serverは、その間に置く小さな構造物だと思っている。目立つ必要はない。ただ、次に読む人が迷わないように、仕様と実装の間に橋を架けておけばいい。
