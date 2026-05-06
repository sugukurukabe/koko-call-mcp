// 子 MCP Registry の Zod スキーマ定義
// Zod schema for child MCP Registry
// Skema Zod untuk Registry MCP anak

import { z } from "zod";

export const AuthTypeSchema = z.enum(["none", "bearer_apikey", "bearer_oauth"]);
export type AuthType = z.infer<typeof AuthTypeSchema>;

export const RiskLevelSchema = z.enum(["read_only", "read_write", "financial"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// エージェントの目的に応じた動的ツール絞り込みモード（ADR-0017, ADR-0022）
// Dynamic tool filtering mode based on agent purpose (ADR-0017, ADR-0022)
// Mode pemfilteran alat dinamis berdasarkan tujuan agen (ADR-0017, ADR-0022)
//
// ADR-0022 で固定 enum から動的文字列に移行。registry.json の tool_modes キーが mode を定義する。
// full_orchestration は予約済み mode として全サーバー表示の特別扱いを維持する。
export const GatewayModeSchema = z.string().min(1);
export type GatewayMode = z.infer<typeof GatewayModeSchema>;

// 予約済み mode: 全サーバー表示
// Reserved mode: shows all servers
// Mode yang dicadangkan: menampilkan semua server
export const FULL_ORCHESTRATION_MODE = "full_orchestration";

// mode → 公開するツール名リスト（空配列 = このモードではツール非表示）
// mode → list of tool names to expose (empty array = hidden in this mode)
// mode → daftar nama alat yang diekspos (array kosong = tersembunyi dalam mode ini)
export const ToolModesSchema = z.record(z.string(), z.array(z.string()));
export type ToolModes = z.infer<typeof ToolModesSchema>;

// ツール単位のポリシー設定（ADR-0019）
// Per-tool policy configuration (ADR-0019)
// Konfigurasi kebijakan per alat (ADR-0019)
export const ToolPolicySchema = z.object({
  // true の場合、HMAC 署名付き approval token が必要（書込み系・金融系ツール用）
  // When true, a HMAC-signed approval token is required (for write/financial tools)
  // Jika true, token persetujuan bertanda tangan HMAC diperlukan (untuk alat tulis/keuangan)
  required_approval: z.boolean().optional(),
  // 必須の compliance キー一覧。呼び出し側が complianceContext で全て true にしないと denied
  // List of required compliance keys; caller must set all to true in complianceContext
  // Daftar kunci kepatuhan yang wajib; pemanggil harus menetapkan semua ke true di complianceContext
  compliance_check: z.array(z.string()).optional(),
});
export type ToolPolicy = z.infer<typeof ToolPolicySchema>;

export const AttributionSchema = z.object({
  source: z.string(),
  license: z.string(),
  url: z.string().url(),
});
export type Attribution = z.infer<typeof AttributionSchema>;

export const ChildMcpServerSchema = z.object({
  id: z.string().min(1),
  display_name: z.string(),
  display_name_en: z.string(),
  display_name_id: z.string(),
  endpoint: z.string().url(),
  auth_type: AuthTypeSchema,
  risk_level: RiskLevelSchema,
  // 空配列 = 全ツール許可 / empty = allow all tools / kosong = izinkan semua alat
  tool_allowlist: z.array(z.string()),
  // Mode 別ツール絞り込み設定（ADR-0017）/ Mode-based tool filtering (ADR-0017)
  tool_modes: ToolModesSchema.optional(),
  // キャッシュ TTL（秒）。未設定 = キャッシュ禁止 / Cache TTL in seconds. Unset = no cache
  cache_ttl_seconds: z.number().int().nonnegative().optional(),
  // ツール単位のポリシー設定（ADR-0019）/ Per-tool policy settings (ADR-0019)
  tool_policies: z.record(z.string(), ToolPolicySchema).optional(),
  attribution: AttributionSchema,
  routing_keywords: z.array(z.string()),
});
export type ChildMcpServer = z.infer<typeof ChildMcpServerSchema>;

export const RegistrySchema = z.object({
  $schema: z.string().optional(),
  version: z.string(),
  servers: z.array(ChildMcpServerSchema),
});
export type Registry = z.infer<typeof RegistrySchema>;
