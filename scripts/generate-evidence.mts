import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { KkjClient } from "../src/api/kkj-client.js";
import type { Bid } from "../src/domain/bid.js";
import { createJpBidsServer } from "../src/mcp.js";

async function main() {
  const repoEvidenceDir = fileURLToPath(
    new URL("../evidence/tool-and-state-results", import.meta.url),
  );
  const outDirs = [
    repoEvidenceDir,
    ...(process.env.JP_BIDS_EVIDENCE_OUT_DIR ? [process.env.JP_BIDS_EVIDENCE_OUT_DIR] : []),
  ];
  for (const dir of outDirs) {
    await mkdir(dir, { recursive: true });
  }

  async function writeEvidence(name: string, content: string) {
    for (const dir of outDirs) {
      await writeFile(join(dir, name), content, "utf8");
    }
  }

  function makeSyntheticBid(idx: number): Bid {
    const num = String(idx).padStart(4, "0");
    return {
      resultId: idx,
      key: `KKJ-2026-46201-${num}`,
      projectName: `教育情報システム ${idx} 案件仕様書`,
      organizationName: idx % 2 === 0 ? "鹿児島県" : "鹿児島市",
      prefectureName: "鹿児島県",
      cityName: "鹿児島市",
      category: "役務",
      procedureType: "一般競争入札",
      cftIssueDate: "2026-07-21",
      tenderSubmissionDeadline: "2026-08-10T17:00:00+09:00",
      externalDocumentUri: `https://www.pref.kagoshima.jp/docs/notice_${num}.pdf`,
      attachments: [
        {
          name: `仕様書_${num}.pdf`,
          uri: `https://www.pref.kagoshima.jp/docs/notice_${num}.pdf`,
        },
      ],
    };
  }

  const mockBids: Bid[] = [];
  for (let i = 1; i <= 15; i++) {
    mockBids.push(makeSyntheticBid(i));
  }

  const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<Results>
  <SearchResults>
    <SearchHits>${mockBids.length}</SearchHits>
    ${mockBids
      .map(
        (b) => `
    <SearchResult>
      <ResultId>${b.resultId}</ResultId>
      <Key>${b.key}</Key>
      <ProjectName>${b.projectName}</ProjectName>
      <OrganizationName>${b.organizationName}</OrganizationName>
      <PrefectureName>${b.prefectureName}</PrefectureName>
      <CityName>${b.cityName}</CityName>
      <Category>${b.category}</Category>
      <ProcedureType>${b.procedureType}</ProcedureType>
      <CFT_Issue_Date>${b.cftIssueDate}</CFT_Issue_Date>
      <Tender_Submission_Deadline>${b.tenderSubmissionDeadline}</Tender_Submission_Deadline>
      <External_Document_URI>${b.externalDocumentUri}</External_Document_URI>
    </SearchResult>`,
      )
      .join("")}
  </SearchResults>
</Results>`;

  const mockKkjClient = new KkjClient({
    fetchImpl: async () => {
      return new Response(mockXml, {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
    },
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createJpBidsServer({ profile: "public_mvp", kkjClient: mockKkjClient });
  const client = new Client({ name: "evidence-generator-client", version: "0.1.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  // 1. search_bids
  const searchRes = await client.callTool({
    name: "search_bids",
    arguments: { query: "教育", prefecture: "鹿児島県", limit: 15 },
  });
  await writeEvidence("01-search_bids.json", JSON.stringify(searchRes.structuredContent, null, 2));

  // Extract 11 signed bid_refs from search result
  const sc = searchRes.structuredContent as { bids: Array<{ key: string; bidRef: string }> };
  const selected11Refs = sc.bids.slice(0, 11).map((b) => b.bidRef);

  // 2. rank_bids with 11 items
  const rankRes = await client.callTool({
    name: "rank_bids",
    arguments: { bid_refs: selected11Refs },
  });
  await writeEvidence(
    "02-rank_bids_selection.json",
    JSON.stringify(rankRes.structuredContent, null, 2),
  );

  // 3. export_bid_shortlist CSV
  const csvRes = await client.callTool({
    name: "export_bid_shortlist",
    arguments: { bid_refs: selected11Refs, format: "csv" },
  });
  const csvSc = csvRes.structuredContent as { csv: string };
  await writeEvidence("03-export_bid_shortlist.csv", csvSc.csv);

  // 4. export_bid_shortlist JSON
  const jsonRes = await client.callTool({
    name: "export_bid_shortlist",
    arguments: { bid_refs: selected11Refs, format: "json" },
  });
  await writeEvidence(
    "03-export_bid_shortlist.json",
    JSON.stringify(jsonRes.structuredContent, null, 2),
  );

  // 5. extract_bid_requirements (demonstrating extraction OFF behavior with fetch_documents: true)
  const extractRes = await client.callTool({
    name: "extract_bid_requirements",
    arguments: { bid_ref: selected11Refs[0], fetch_documents: true },
  });
  await writeEvidence(
    "04-extract_bid_requirements_off.json",
    JSON.stringify(extractRes.structuredContent, null, 2),
  );

  // 6. get_bid_detail with snapshot
  const detailRes = await client.callTool({
    name: "get_bid_detail",
    arguments: { bid_ref: selected11Refs[0] },
  });
  await writeEvidence("05-get_bid_detail_snapshot.json", JSON.stringify(detailRes, null, 2));

  await client.close();
  await server.close();
}

main().catch((_err) => {
  process.exit(1);
});
