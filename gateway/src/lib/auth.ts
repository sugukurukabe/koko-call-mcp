// Gateway 認証・tier 判定
// Gateway authentication and tier determination
// Autentikasi dan penentuan tier Gateway

import { createHash } from "node:crypto";

export type Tier = "free" | "pro";

// ベータ期間: 明示的に有効化した場合のみ全ユーザーを Pro として扱う
// Beta period: treat all users as Pro only when explicitly enabled
// Periode beta: perlakukan semua pengguna sebagai Pro hanya jika diaktifkan secara eksplisit
const BETA_UNTIL = new Date("2026-09-01T00:00:00+09:00");

export function isInBetaPeriod(now: Date = new Date()): boolean {
  return now < BETA_UNTIL;
}

export function isBetaProEnabled(value: string | undefined): boolean {
  return value === "true";
}

export function parseProApiKeys(value: string | undefined): ReadonlySet<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0),
  );
}

export function parseTier(
  authHeader: string | undefined,
  proKeys: ReadonlySet<string>,
  now: Date = new Date(),
  betaProEnabled = isBetaProEnabled(process.env.GATEWAY_ENABLE_BETA_PRO),
): Tier {
  if (betaProEnabled && isInBetaPeriod(now)) return "pro";
  if (proKeys.size === 0) return "free";
  if (!authHeader) return "free";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match?.[1]) return "free";
  return proKeys.has(match[1].trim()) ? "pro" : "free";
}

/**
 * APIキーまたはJWTのsubをSHA-256でハッシュ化する（監査ログ用）
 * Hash API key or JWT sub with SHA-256 (for audit logs)
 * Hash kunci API atau sub JWT dengan SHA-256 (untuk log audit)
 */
export function hashActor(rawActor: string): string {
  return createHash("sha256").update(rawActor).digest("hex").slice(0, 16);
}

export function extractBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1];
}
