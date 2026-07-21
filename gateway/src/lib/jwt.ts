// Gateway JWT 検証ユーティリティ
// Gateway JWT verification utility
// Utilitas verifikasi JWT Gateway

import { createHmac, timingSafeEqual } from "node:crypto";

export interface JwtPayload {
  [key: string]: unknown;
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  type?: string;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url"),
  );
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as JwtPayload;
    if (parsed.exp !== undefined && parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}
