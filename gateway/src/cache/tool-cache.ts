// 読み取り専用ツール呼び出し結果の TTL キャッシュ（ADR-0018）
// TTL cache for read-only tool call results (ADR-0018)
// Cache TTL untuk hasil panggilan alat read-only (ADR-0018)

import { createHash } from "node:crypto";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

// 最大エントリ数 / Max entries / Entri maksimum
const MAX_ENTRIES = 1_000;

const store = new Map<string, CacheEntry>();

/**
 * 引数オブジェクトからキャッシュキーを生成する
 * Generate a cache key from server ID, tool name, and arguments
 * Hasilkan kunci cache dari ID server, nama alat, dan argumen
 */
export function buildCacheKey(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
): string {
  // キーのソートで引数順序依存を排除する
  // Sort keys to eliminate argument-order dependency
  // Urutkan kunci untuk menghilangkan ketergantungan urutan argumen
  const sorted = JSON.stringify(args, Object.keys(args).sort());
  const hash = createHash("sha256").update(sorted).digest("hex").slice(0, 16);
  return `${serverId}:${toolName}:${hash}`;
}

/**
 * キャッシュから値を取得する（TTL 切れは null）
 * Get a value from the cache (returns null if expired or missing)
 * Dapatkan nilai dari cache (mengembalikan null jika kadaluarsa atau tidak ada)
 */
export function get(key: string): unknown | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * キャッシュに値をセットする
 * Set a value in the cache with TTL in seconds
 * Setel nilai dalam cache dengan TTL dalam detik
 */
export function set(key: string, value: unknown, ttlSeconds: number): void {
  // エントリ上限に達した場合は最古のエントリを削除する
  // If at capacity, evict the oldest entry
  // Jika kapasitas penuh, hapus entri tertua
  if (store.size >= MAX_ENTRIES) {
    const firstKey = store.keys().next().value;
    if (firstKey !== undefined) {
      store.delete(firstKey);
    }
  }
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * キャッシュ全体をクリアする（テスト・強制更新用）
 * Clear the entire cache (for tests or forced refresh)
 * Hapus seluruh cache (untuk pengujian atau pembaruan paksa)
 */
export function clear(): void {
  store.clear();
}

let hitCount = 0;
let missCount = 0;

/**
 * キャッシュヒット/ミスを記録する
 * Record a cache hit or miss
 * Catat hit atau miss cache
 */
export function recordHit(): void {
  hitCount++;
}
export function recordMiss(): void {
  missCount++;
}

/**
 * キャッシュ統計を返す（デバッグ・可視化用）
 * Return cache statistics (for debugging and visibility)
 * Kembalikan statistik cache (untuk debugging dan visibilitas)
 */
export function stats(): {
  size: number;
  maxEntries: number;
  hits: number;
  misses: number;
  hitRate: string;
} {
  const total = hitCount + missCount;
  const rate = total > 0 ? ((hitCount / total) * 100).toFixed(1) : "0.0";
  return {
    size: store.size,
    maxEntries: MAX_ENTRIES,
    hits: hitCount,
    misses: missCount,
    hitRate: `${rate}%`,
  };
}
