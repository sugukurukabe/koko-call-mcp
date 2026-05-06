// Mode に基づいてツールリストを動的に絞り込む（ADR-0017, ADR-0022）
// Dynamically filter tool list based on Mode (ADR-0017, ADR-0022)
// Filter daftar alat secara dinamis berdasarkan Mode (ADR-0017, ADR-0022)

import type { ChildMcpServer, GatewayMode } from "../registry/schema.js";
import { FULL_ORCHESTRATION_MODE } from "../registry/schema.js";

export interface ToolInfo {
  name: string;
  description?: string;
}

/**
 * サーバーとモードに応じて公開すべきツール名セットを返す
 * Returns the set of tool names that should be exposed for the given server and mode
 * Mengembalikan kumpulan nama alat yang harus diekspos untuk server dan mode yang diberikan
 *
 * ADR-0022 で一般化: mode はハードコードせず tool_modes[mode] の有無で判定する。
 * full_orchestration のみ予約 mode として全サーバー表示を維持する。
 *
 * 優先順位 / Priority / Prioritas:
 *   full_orchestration:
 *     1. tool_modes["full_orchestration"] が非空 → そのリスト
 *     2. tool_allowlist が非空 → allowlist
 *     3. null（全ツール許可）
 *   focused mode（それ以外）:
 *     1. tool_modes[mode] が未定義 or 空 → Set()（非表示）
 *     2. tool_modes[mode] が非空 → そのリスト
 */
export function resolveAllowedToolNames(
  server: ChildMcpServer,
  mode: GatewayMode,
): Set<string> | null {
  if (mode === FULL_ORCHESTRATION_MODE) {
    const orchTools = server.tool_modes?.[FULL_ORCHESTRATION_MODE];
    if (orchTools !== undefined && orchTools.length > 0) {
      return new Set(orchTools);
    }
    if (server.tool_allowlist.length > 0) {
      return new Set(server.tool_allowlist);
    }
    return null;
  }

  const modeTools = server.tool_modes?.[mode];
  if (modeTools === undefined || modeTools.length === 0) {
    return new Set();
  }
  return new Set(modeTools);
}

/**
 * ツールリストをモードとサーバー設定に従いフィルタリングして返す
 * Filter a list of tools according to mode and server configuration
 * Filter daftar alat sesuai dengan mode dan konfigurasi server
 */
export function filterTools(
  tools: ToolInfo[],
  server: ChildMcpServer,
  mode: GatewayMode,
): ToolInfo[] {
  const allowed = resolveAllowedToolNames(server, mode);
  if (allowed === null) return tools; // no restriction
  if (allowed.size === 0) return []; // all hidden for this mode
  return tools.filter((t) => allowed.has(t.name));
}

/**
 * サーバー自体がモード上表示対象かどうかを返す
 * Return whether the server should be visible for the mode
 * Mengembalikan apakah server harus terlihat untuk mode tersebut
 */
export function isServerVisibleInMode(server: ChildMcpServer, mode: GatewayMode): boolean {
  if (mode === FULL_ORCHESTRATION_MODE) return true;
  const allowed = resolveAllowedToolNames(server, mode);
  return allowed === null || allowed.size > 0;
}

/**
 * ツール名がモードとサーバー設定に従い許可されているか確認する
 * Check whether a tool name is permitted under the given mode and server
 * Periksa apakah nama alat diizinkan dalam mode dan server yang diberikan
 */
export function isToolPermitted(
  toolName: string,
  server: ChildMcpServer,
  mode: GatewayMode,
): boolean {
  const allowed = resolveAllowedToolNames(server, mode);
  if (allowed === null) return true;
  return allowed.has(toolName);
}
