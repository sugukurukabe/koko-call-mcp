import type { Attribution } from "./attribution.js";
import type { Bid, BidQuestionDraft, BidRequirementExtraction } from "./bid.js";
import { extractBidRequirements } from "./bid-requirements.js";

export function draftBidQuestions(
  bid: Bid,
  attribution: Attribution,
  requirementsOverride?: BidRequirementExtraction,
): BidQuestionDraft {
  const requirements = requirementsOverride ?? extractBidRequirements(bid, attribution);
  const questions = deriveQuestionTopics(requirements).map((item) => toQuestion(item, bid));
  const title = `質問書ドラフト: ${bid.projectName}`;
  return {
    bid,
    title,
    markdown: toMarkdown(title, bid, questions, attribution),
    questions,
    reviewNotes: [
      "この質問書はドラフトです。提出前に公式公告・仕様書・入札説明書と照合してください。",
      "発注機関の指定様式、質問期限、提出方法を必ず確認してください。",
      "断定表現を避け、確認依頼として送付してください。",
    ],
    attribution,
  };
}

function toQuestion(topic: string, bid: Bid): BidQuestionDraft["questions"][number] {
  const base = {
    topic,
    source: bid.externalDocumentUri ?? "公式公告ページまたは添付資料を確認してください",
  };
  if (topic.includes("質問期限")) {
    return {
      ...base,
      question: "本件に関する質問の提出期限、提出方法、回答予定日はいつでしょうか。",
      reason: "検索結果から質問期限を確認できないため。",
    };
  }
  if (topic.includes("曖昧点")) {
    return {
      ...base,
      question: topic.replace(/^曖昧点[:：]\s*/, ""),
      reason: "PDF/公告文のAI抽出で、人間確認が必要な曖昧点として検出されたため。",
    };
  }
  if (topic.includes("提出書類")) {
    return {
      ...base,
      question: "入札参加に必要な提出書類一式と、各書類の提出形式を確認させてください。",
      reason: "提出書類の不足は失格リスクにつながるため。",
    };
  }
  if (topic.includes("参加資格") || topic.includes("営業品目")) {
    return {
      ...base,
      question:
        "参加に必要な資格、等級、営業品目、地域要件について、該当条件を確認させてください。",
      reason: "自社資格との照合に必要なため。",
    };
  }
  if (topic.includes("失格") || topic.includes("注意事項")) {
    return {
      ...base,
      question:
        "入札参加時の失格条件、特に注意すべき提出不備、様式指定、押印要否を確認させてください。",
      reason: "提出不備や様式違反を避けるため。",
    };
  }
  if (topic.includes("契約期間") || topic.includes("納入期限")) {
    return {
      ...base,
      question: "契約期間、履行期間、納入期限、作業開始予定日を確認させてください。",
      reason: "社内体制と工数見積もりに必要なため。",
    };
  }
  return {
    ...base,
    question: `${topic}について、公告または仕様書上の該当箇所を確認させてください。`,
    reason: "検索結果だけでは確認できないため。",
  };
}

function deriveQuestionTopics(requirements: BidRequirementExtraction): string[] {
  const extracted = requirements.extractedRequirements;
  if (!extracted) {
    return requirements.missingRequirements;
  }
  const topics = [...requirements.missingRequirements];
  if (extracted.eligibility.length > 0) {
    removeTopics(topics, ["参加資格", "営業品目"]);
  }
  if (extracted.requiredDocuments.length > 0) {
    removeTopics(topics, ["提出書類"]);
  }
  if (extracted.tenderSubmissionDeadline) {
    removeTopics(topics, ["提出期限"]);
  }
  if (extracted.openingDate) {
    removeTopics(topics, ["開札日"]);
  }
  if (extracted.deliveryDeadline || extracted.contractPeriod) {
    removeTopics(topics, ["契約期間", "納入期限"]);
  }
  if (extracted.disqualification.length > 0) {
    removeTopics(topics, ["失格", "注意事項"]);
  }
  for (const ambiguousPoint of extracted.ambiguousPoints) {
    topics.push(`曖昧点: ${ambiguousPoint}`);
  }
  if (!extracted.questionDeadline) {
    topics.push("質問期限");
  }
  return [...new Set(topics)];
}

function removeTopics(topics: string[], fragments: string[]): void {
  for (let index = topics.length - 1; index >= 0; index -= 1) {
    if (fragments.some((fragment) => topics[index]?.includes(fragment))) {
      topics.splice(index, 1);
    }
  }
}

function toMarkdown(
  title: string,
  bid: Bid,
  questions: BidQuestionDraft["questions"],
  attribution: Attribution,
): string {
  return [
    `# ${title}`,
    "",
    "## 対象案件",
    "",
    `- 件名: ${bid.projectName}`,
    `- Key: ${bid.key}`,
    `- 発注機関: ${bid.organizationName ?? "不明"}`,
    `- 公告URL: ${bid.externalDocumentUri ?? "要確認"}`,
    "",
    "## 質問案",
    "",
    ...questions.flatMap((question, index) => [
      `### ${index + 1}. ${question.topic}`,
      "",
      question.question,
      "",
      `理由: ${question.reason}`,
      "",
    ]),
    "## 提出前確認",
    "",
    "- 公式公告・仕様書・入札説明書と照合する",
    "- 発注機関指定の質問様式がある場合は、その様式へ転記する",
    "- 質問期限と回答公開方法を確認する",
    "",
    `出典: ${attribution.dataSource}`,
  ].join("\n");
}
