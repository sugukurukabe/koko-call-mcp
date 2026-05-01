import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { KkjClient } from "../api/kkj-client.js";
import { createAttribution } from "../domain/attribution.js";
import { prefectureCodeToName, prefectureEntries } from "../domain/prefectures.js";
import { jsonText } from "../lib/tool-result.js";

export function registerResources(server: McpServer, client: KkjClient): void {
  server.registerResource(
    "kkj_attribution",
    "attribution://kkj",
    {
      title: "KKJ Attribution",
      description: "官公需情報ポータルサイトの出典情報。",
      mimeType: "application/json",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: jsonText(createAttribution()),
        },
      ],
    }),
  );

  server.registerResource(
    "kkj_api_reference",
    "docs://api-reference",
    {
      title: "KKJ API Reference",
      description: "JP Bids MCPで使うKKJ APIパラメータの要約。",
      mimeType: "text/markdown",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: [
            "# KKJ API Reference",
            "",
            "- Endpoint: `http://www.kkj.go.jp/api/`",
            "- Required: one of `Query`, `Project_Name`, `Organization_Name`, `LG_Code`",
            "- Response: XML",
            "- Count: max 1,000",
          ].join("\n"),
        },
      ],
    }),
  );

  server.registerResource(
    "prefecture_codes",
    "codes://prefectures",
    {
      title: "JIS X0401 Prefecture Codes",
      description: "都道府県名とLG_Codeの対応表。",
      mimeType: "application/json",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: jsonText(prefectureEntries),
        },
      ],
    }),
  );

  server.registerResource(
    "bid_detail_template",
    new ResourceTemplate("bid://{bid_key}", {
      list: undefined,
      complete: {
        bid_key: (value) => client.completeBidKeys(value),
      },
    }),
    {
      title: "Bid Detail Template",
      description: "直近検索済みのbid_keyを補完し、該当Keyの検索導線を返す。",
      mimeType: "application/json",
    },
    (uri, variables) => {
      const bidKey = String(variables.bid_key ?? "");
      const cachedBid = client.getCachedBid(bidKey);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: jsonText(
              cachedBid
                ? { bidKey, bid: cachedBid, attribution: createAttribution() }
                : {
                    bidKey,
                    instruction:
                      "Use get_bid_detail with this bid_key to fetch the current official detail.",
                  },
            ),
          },
        ],
      };
    },
  );

  server.registerResource(
    "prefecture_template",
    new ResourceTemplate("prefecture://{lg_code}", {
      list: undefined,
      complete: {
        lg_code: (value) =>
          prefectureEntries
            .map((entry) => entry.code)
            .filter((code) => code.startsWith(value))
            .slice(0, 47),
      },
    }),
    {
      title: "Prefecture Code Template",
      description: "LG_Codeから都道府県名を参照する。",
      mimeType: "application/json",
    },
    (uri, variables) => {
      const code = String(variables.lg_code ?? "");
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: jsonText({ code, name: prefectureCodeToName.get(code) ?? null }),
          },
        ],
      };
    },
  );
}
