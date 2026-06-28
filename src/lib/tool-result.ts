import { UserInputError } from "./errors.js";

export function toolError(error: unknown, fallbackMessage: string) {
  if (error instanceof UserInputError) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: error.message }],
    };
  }
  console.error(error);
  return {
    isError: true,
    content: [{ type: "text" as const, text: fallbackMessage }],
  };
}

export function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

// MCP resource_link content block — 公式公告ページや添付資料へのリンクを返す
// MCP resource_link content block — return links to official announcement pages or attachments
// Blok konten resource_link MCP — kembalikan tautan ke halaman pengumuman resmi atau lampiran
export function resourceLink(uri: string, name: string, mimeType?: string) {
  return {
    type: "resource_link" as const,
    uri,
    name,
    ...(mimeType ? { mimeType } : {}),
  };
}
