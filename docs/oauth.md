# OAuth 2.0 運用メモ / OAuth 2.0 Operations / Catatan Operasi OAuth 2.0

## 日本語

JP Bids MCP の remote endpoint (`/mcp`) は OAuth 2.0 Bearer token を受け付ける。認可サーバーは次の仕様を基準にする。

- RFC 8414: Authorization Server Metadata
- RFC 7591: Dynamic Client Registration
- RFC 7636: PKCE
- RFC 8707: Resource Indicators
- RFC 9207: Authorization Server Issuer Identification
- RFC 9728: Protected Resource Metadata

`/mcp` が受理するのは、`type: "access_token"`、`iss` が公開base URL、`aud` が `${base}/mcp`、`scope` に `mcp:read` を含むJWTだけである。authorization code と refresh token は `/mcp` では必ず拒否する。

本番では `JP_BIDS_OAUTH_STORE=firestore` を使い、Cloud Firestore に次の状態を保持する。

| 種類 | 目的 | TTL / 失効 |
|---|---|---|
| DCR client | `client_id` と許可済み `redirect_uris` の結合 | 90日。`expiresAtDate` をFirestore TTL policyの対象にする |
| Authorization code | PKCE、client、redirect URI、resource の一回限り結合 | 5分。token exchangeで消費済みにする |
| Refresh token | refresh token familyのrotationとreuse detection | 30日。使用時に消費済みにし、新しいrefresh tokenを発行 |
| Refresh family | 再利用検知時にfamily全体を失効 | reuse検知時にcompromised |

ローカル開発では `JP_BIDS_OAUTH_STORE=memory` を使える。本番 (`K_SERVICE` がある環境) でmemory storeを指定した場合は起動を拒否する。

OAuth認証と有料tierは同じものではない。ベータ期間中は公開体験としてOAuth利用者にもPro相当のtool surfaceを見せるが、ベータ終了後はentitlementを別に確認する。API keyは完全一致のallowlistで扱い、`.` を含むkeyでもJWTとして誤拒否しない。

## English

The JP Bids MCP remote endpoint (`/mcp`) accepts OAuth 2.0 Bearer tokens. The authorization server is based on:

- RFC 8414: Authorization Server Metadata
- RFC 7591: Dynamic Client Registration
- RFC 7636: PKCE
- RFC 8707: Resource Indicators
- RFC 9207: Authorization Server Issuer Identification
- RFC 9728: Protected Resource Metadata

`/mcp` accepts only JWTs with `type: "access_token"`, `iss` equal to the public base URL, `aud` equal to `${base}/mcp`, and `scope` containing `mcp:read`. Authorization codes and refresh tokens are always rejected at `/mcp`.

Production uses `JP_BIDS_OAUTH_STORE=firestore` and stores the following state in Cloud Firestore.

| Kind | Purpose | TTL / Revocation |
|---|---|---|
| DCR client | Binds `client_id` to approved `redirect_uris` | 90 days. `expiresAtDate` is intended for Firestore TTL policy |
| Authorization code | One-time binding for PKCE, client, redirect URI, and resource | 5 minutes. Consumed during token exchange |
| Refresh token | Refresh token family rotation and reuse detection | 30 days. Consumed on use and replaced |
| Refresh family | Revokes a family after reuse detection | Marked compromised on reuse |

Local development can use `JP_BIDS_OAUTH_STORE=memory`. Production (`K_SERVICE`) refuses to start with the memory store.

OAuth authentication is not the same as paid-tier entitlement. During the beta period, OAuth users receive the Pro-equivalent public beta tool surface. After beta, entitlement must be checked separately. API keys are exact allowlist matches, so keys containing `.` are not wrongly rejected as invalid JWTs.

## Bahasa Indonesia

Endpoint remote JP Bids MCP (`/mcp`) menerima OAuth 2.0 Bearer token. Authorization server mengikuti:

- RFC 8414: Authorization Server Metadata
- RFC 7591: Dynamic Client Registration
- RFC 7636: PKCE
- RFC 8707: Resource Indicators
- RFC 9207: Authorization Server Issuer Identification
- RFC 9728: Protected Resource Metadata

`/mcp` hanya menerima JWT dengan `type: "access_token"`, `iss` sama dengan base URL publik, `aud` sama dengan `${base}/mcp`, dan `scope` berisi `mcp:read`. Authorization code dan refresh token selalu ditolak di `/mcp`.

Produksi memakai `JP_BIDS_OAUTH_STORE=firestore` dan menyimpan state berikut di Cloud Firestore.

| Jenis | Tujuan | TTL / Pencabutan |
|---|---|---|
| DCR client | Mengikat `client_id` ke `redirect_uris` yang disetujui | 90 hari. `expiresAtDate` disiapkan untuk Firestore TTL policy |
| Authorization code | Ikatan sekali pakai untuk PKCE, client, redirect URI, dan resource | 5 menit. Dikonsumsi saat token exchange |
| Refresh token | Rotasi refresh token family dan deteksi reuse | 30 hari. Dikonsumsi saat dipakai dan diganti |
| Refresh family | Mencabut satu family setelah reuse terdeteksi | Ditandai compromised saat reuse |

Pengembangan lokal dapat memakai `JP_BIDS_OAUTH_STORE=memory`. Produksi (`K_SERVICE`) menolak start dengan memory store.

Autentikasi OAuth tidak sama dengan entitlement tier berbayar. Selama periode beta, pengguna OAuth mendapat tool surface beta setara Pro. Setelah beta, entitlement harus diperiksa secara terpisah. API key dicocokkan secara persis dengan allowlist, sehingga key yang mengandung `.` tidak salah ditolak sebagai JWT invalid.
