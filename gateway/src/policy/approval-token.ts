// HMAC 署名付き Approval Token の発行と検証（ADR-0019）
// Issue and verify HMAC-signed approval tokens (ADR-0019)
// Penerbitan dan verifikasi token persetujuan bertanda tangan HMAC (ADR-0019)

import { createHmac, timingSafeEqual } from "node:crypto";

// デフォルト TTL: 5 分（300 秒）
// Default TTL: 5 minutes (300 seconds)
// TTL default: 5 menit (300 detik)
const DEFAULT_TTL_SECONDS = 300;

/**
 * 環境変数 GATEWAY_APPROVAL_HMAC_SECRET を取得する
 * Get the GATEWAY_APPROVAL_HMAC_SECRET environment variable
 * Mendapatkan variabel lingkungan GATEWAY_APPROVAL_HMAC_SECRET
 */
function getHmacSecret(): string {
  const secret = process.env.GATEWAY_APPROVAL_HMAC_SECRET;
  if (!secret) {
    throw new Error(
      "GATEWAY_APPROVAL_HMAC_SECRET is not set. " +
        "Set this env var to enable approval tokens for financial tool calls.",
    );
  }
  return secret;
}

/**
 * トークンのペイロード（署名対象）を構築する
 * Build the token payload (subject of signature)
 * Membangun payload token (subjek tanda tangan)
 */
function buildPayload(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
  expiresAt: number,
): string {
  return JSON.stringify({
    server_id: serverId,
    tool_name: toolName,
    args,
    expires_at: expiresAt,
  });
}

export interface ApprovalToken {
  payload: string;
  signature: string;
  expires_at: number;
}

/**
 * Approval Token を発行する
 * Issue an approval token
 * Menerbitkan token persetujuan
 *
 * @param serverId - 子 MCP サーバー ID / Child MCP server ID / ID server MCP anak
 * @param toolName - ツール名 / Tool name / Nama alat
 * @param args - ツール引数 / Tool arguments / Argumen alat
 * @param ttlSeconds - 有効期限（秒）/ TTL in seconds / TTL dalam detik
 * @returns Base64 エンコードされたトークン文字列 / Base64-encoded token string / String token dikodekan Base64
 */
export function issue(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const secret = getHmacSecret();
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = buildPayload(serverId, toolName, args, expiresAt);
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  const token: ApprovalToken = { payload, signature, expires_at: expiresAt };
  return Buffer.from(JSON.stringify(token)).toString("base64url");
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "invalid_signature" | "malformed" | "args_mismatch" };

/**
 * Approval Token を検証する
 * Verify an approval token
 * Memverifikasi token persetujuan
 *
 * @param token - Base64 エンコードされたトークン文字列 / Base64-encoded token / String token dikodekan Base64
 * @param serverId - 期待する子 MCP サーバー ID / Expected child MCP server ID / ID server MCP anak yang diharapkan
 * @param toolName - 期待するツール名 / Expected tool name / Nama alat yang diharapkan
 * @param args - 実際の呼び出し引数 / Actual call arguments / Argumen panggilan aktual
 */
export function verify(
  token: string,
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
): VerifyResult {
  let parsed: ApprovalToken;
  try {
    parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as ApprovalToken;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    typeof parsed.payload !== "string" ||
    typeof parsed.signature !== "string" ||
    typeof parsed.expires_at !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  // TTL チェック / TTL check / Pemeriksaan TTL
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > parsed.expires_at) {
    return { ok: false, reason: "expired" };
  }

  // 署名検証（タイミング攻撃対策） / Signature verification (timing-safe) / Verifikasi tanda tangan (aman dari timing)
  let secret: string;
  try {
    secret = getHmacSecret();
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
  const expectedSig = createHmac("sha256", secret).update(parsed.payload).digest("hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");
  const actualBuf = Buffer.from(parsed.signature, "hex");
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return { ok: false, reason: "invalid_signature" };
  }

  // ペイロード内容とリクエスト引数の一致確認
  // Verify that payload content matches request arguments
  // Verifikasi bahwa konten payload cocok dengan argumen permintaan
  let payloadObj: { server_id: string; tool_name: string; args: Record<string, unknown> };
  try {
    payloadObj = JSON.parse(parsed.payload) as typeof payloadObj;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (payloadObj.server_id !== serverId || payloadObj.tool_name !== toolName) {
    return { ok: false, reason: "args_mismatch" };
  }

  // 引数の完全一致確認（JSON 正規化で比較）
  // Verify exact argument match (compare via JSON normalization)
  // Verifikasi kecocokan argumen tepat (bandingkan melalui normalisasi JSON)
  if (JSON.stringify(payloadObj.args) !== JSON.stringify(args)) {
    return { ok: false, reason: "args_mismatch" };
  }

  return { ok: true };
}
