// OAuth 2.0 JWT署名・検証ユーティリティ
// OAuth 2.0 JWT signing and verification utilities
// Utilitas tanda tangan dan verifikasi JWT OAuth 2.0

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface JwtPayload {
  [key: string]: unknown;
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  jti?: string;
}

/**
 * HMAC-SHA256でJWTに署名する
 * Sign a JWT with HMAC-SHA256
 * Tanda tangani JWT dengan HMAC-SHA256
 */
export function signJwt(payload: JwtPayload, secret: string, expiresInSeconds: number): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const full: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    jti: payload.jti ?? randomBytes(16).toString("hex"),
  };
  const h = Buffer.from(JSON.stringify(header)).toString("base64url");
  const p = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${sig}`;
}

/**
 * JWTを検証してペイロードを返す（無効ならnull）
 * Verify JWT and return payload (null if invalid)
 * Verifikasi JWT dan kembalikan payload (null jika tidak valid)
 */
export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url"),
  );
  const actual = Buffer.from(s);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(p, "base64url").toString()) as JwtPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * PKCE S256を検証する
 * Verify PKCE S256 code_challenge against code_verifier
 * Verifikasi PKCE S256 code_challenge terhadap code_verifier
 */
export function verifyPkceS256(verifier: string, challenge: string): boolean {
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

export function generateId(): string {
  return randomBytes(16).toString("hex");
}
