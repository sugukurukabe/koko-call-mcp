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

本番では `JP_BIDS_OAUTH_STORE=firestore` を使い、Cloud Firestore に次の5コレクションを保持する（全5コレクションで Firestore Native TTL ポリシー `ACTIVE` 化済み）。

| 種類 | コレクション | 目的 | TTL / 失効 |
|---|---|---|---|
| DCR client | `jp_bids_oauth_clients` | `client_id` と許可済み `redirect_uris` の結合 | 90日（`expiresAtDate` TTL `ACTIVE`） |
| Authorization code | `jp_bids_oauth_authorization_codes` | PKCE、client、redirect URI、resource の一回限り結合 | 5分（`expiresAtDate` TTL `ACTIVE`、token exchangeで消費済み） |
| Refresh token | `jp_bids_oauth_refresh_tokens` | refresh token familyのrotationとreuse detection | 30日（`expiresAtDate` TTL `ACTIVE`、使用時に消費済み） |
| Refresh family | `jp_bids_oauth_refresh_families` | 再利用検知時にfamily全体を失効 | 30日（`expiresAtDate` TTL `ACTIVE`、reuse検知時にcompromised） |
| Rate-limit bucket | `jp_bids_oauth_rate_limits` | `/oauth/*` 単位のレート制限カウンタ | 60秒（`resetAtDate` TTL `ACTIVE`） |

Cloudflare エッジゲートウェイ経由のトラフィックでは、`X-Jpbids-Edge-Auth` を定数時間照合で検証できた場合に限り `X-Jpbids-Client-Ip-Hash`（日次ソルト付き不可逆ハッシュ）を OAuth レート制限キーとして採用し、エッジ配下でのバケット衝突を防ぎつつ生IPアドレスを保存しない（詳細: [`cloudflare-edge-mcp-playbook.md`](./cloudflare-edge-mcp-playbook.md)）。

ローカル開発では `JP_BIDS_OAUTH_STORE=memory` を使える。本番 (`K_SERVICE` がある環境) でmemory storeを指定した場合は起動を拒否する。

現行の公開本番プロファイル（`JP_BIDS_PROFILE=public_mvp`）は完全無料・読み取り専用の公開7ツールを提供し、有料プランや実行時 Stripe 課金判定は行わない。API key を構成するローカル・自己ホスト環境では完全一致のallowlistで扱い、`.` を含むkeyでもJWTとして誤拒否しない。

## English

The JP Bids MCP remote endpoint (`/mcp`) accepts OAuth 2.0 Bearer tokens. The authorization server is based on:

- RFC 8414: Authorization Server Metadata
- RFC 7591: Dynamic Client Registration
- RFC 7636: PKCE
- RFC 8707: Resource Indicators
- RFC 9207: Authorization Server Issuer Identification
- RFC 9728: Protected Resource Metadata

`/mcp` accepts only JWTs with `type: "access_token"`, `iss` equal to the public base URL, `aud` equal to `${base}/mcp`, and `scope` containing `mcp:read`. Authorization codes and refresh tokens are always rejected at `/mcp`.

Production uses `JP_BIDS_OAUTH_STORE=firestore` and stores the following 5 collections in Cloud Firestore (Firestore Native TTL policies are `ACTIVE` on all 5 collections).

| Kind | Collection | Purpose | TTL / Revocation |
|---|---|---|---|
| DCR client | `jp_bids_oauth_clients` | Binds `client_id` to approved `redirect_uris` | 90 days (`expiresAtDate` TTL `ACTIVE`) |
| Authorization code | `jp_bids_oauth_authorization_codes` | One-time binding for PKCE, client, redirect URI, and resource | 5 minutes (`expiresAtDate` TTL `ACTIVE`, consumed on exchange) |
| Refresh token | `jp_bids_oauth_refresh_tokens` | Refresh token family rotation and reuse detection | 30 days (`expiresAtDate` TTL `ACTIVE`, consumed on use) |
| Refresh family | `jp_bids_oauth_refresh_families` | Revokes a family after reuse detection | 30 days (`expiresAtDate` TTL `ACTIVE`, marked compromised on reuse) |
| Rate-limit bucket | `jp_bids_oauth_rate_limits` | Per-client rate-limit counters for `/oauth/*` | 60 seconds (`resetAtDate` TTL `ACTIVE`) |

For requests arriving via the Cloudflare Edge Gateway, Cloud Run verifies `X-Jpbids-Edge-Auth` in constant time and uses the daily-salted `X-Jpbids-Client-Ip-Hash` as the OAuth rate-limit bucket key, isolating clients behind the edge proxy without storing raw IP addresses (see [`cloudflare-edge-mcp-playbook.md`](./cloudflare-edge-mcp-playbook.md)).

Local development can use `JP_BIDS_OAUTH_STORE=memory`. Production (`K_SERVICE`) refuses to start with the memory store.

The live public profile (`JP_BIDS_PROFILE=public_mvp`) exposes 7 free, read-only tools with zero paid tiers or runtime Stripe billing checks. In self-hosted/local configurations that define API keys, keys are matched via an exact allowlist so keys containing `.` are never misclassified as malformed JWTs.

## Bahasa Indonesia

Endpoint remote JP Bids MCP (`/mcp`) menerima OAuth 2.0 Bearer token. Authorization server mengikuti:

- RFC 8414: Authorization Server Metadata
- RFC 7591: Dynamic Client Registration
- RFC 7636: PKCE
- RFC 8707: Resource Indicators
- RFC 9207: Authorization Server Issuer Identification
- RFC 9728: Protected Resource Metadata

`/mcp` hanya menerima JWT dengan `type: "access_token"`, `iss` sama dengan base URL publik, `aud` sama dengan `${base}/mcp`, dan `scope` berisi `mcp:read`. Authorization code dan refresh token selalu ditolak di `/mcp`.

Produksi memakai `JP_BIDS_OAUTH_STORE=firestore` dan menyimpan 5 koleksi berikut di Cloud Firestore (kebijakan Firestore Native TTL berstatus `ACTIVE` pada kelima koleksi).

| Jenis | Koleksi | Tujuan | TTL / Pencabutan |
|---|---|---|---|
| DCR client | `jp_bids_oauth_clients` | Mengikat `client_id` ke `redirect_uris` yang disetujui | 90 hari (`expiresAtDate` TTL `ACTIVE`) |
| Authorization code | `jp_bids_oauth_authorization_codes` | Ikatan sekali pakai untuk PKCE, client, redirect URI, dan resource | 5 menit (`expiresAtDate` TTL `ACTIVE`, dikonsumsi saat exchange) |
| Refresh token | `jp_bids_oauth_refresh_tokens` | Rotasi refresh token family dan deteksi reuse | 30 hari (`expiresAtDate` TTL `ACTIVE`, dikonsumsi saat dipakai) |
| Refresh family | `jp_bids_oauth_refresh_families` | Mencabut satu family setelah reuse terdeteksi | 30 hari (`expiresAtDate` TTL `ACTIVE`, ditandai compromised saat reuse) |
| Rate-limit bucket | `jp_bids_oauth_rate_limits` | Penghitung rate-limit per klien pada `/oauth/*` | 60 detik (`resetAtDate` TTL `ACTIVE`) |

Untuk permintaan melalui Cloudflare Edge Gateway, Cloud Run memverifikasi `X-Jpbids-Edge-Auth` secara constant-time dan memakai `X-Jpbids-Client-Ip-Hash` (hash dengan salt harian) sebagai kunci bucket rate-limit OAuth tanpa menyimpan alamat IP mentah (lihat [`cloudflare-edge-mcp-playbook.md`](./cloudflare-edge-mcp-playbook.md)).

Pengembangan lokal dapat memakai `JP_BIDS_OAUTH_STORE=memory`. Produksi (`K_SERVICE`) menolak start dengan memory store.

Profil publik saat ini (`JP_BIDS_PROFILE=public_mvp`) menyediakan 7 alat gratis & read-only tanpa paket berbayar atau pemanggilan Stripe saat runtime. Pada konfigurasi lokal/self-hosted yang memakai API key, kunci dicocokkan secara persis dengan allowlist sehingga key yang mengandung `.` tidak salah ditolak sebagai JWT invalid.
