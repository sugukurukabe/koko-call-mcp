// 環境変数のパースと検証
// Environment variable parsing and validation
// Parsing dan validasi variabel lingkungan

export function parsePortEnv(value: string | undefined, defaultPort: number): number {
  if (!value) return defaultPort;
  const port = parseInt(value, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }
  return port;
}

export function parsePositiveNumberEnv(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const n = parseFloat(value);
  if (Number.isNaN(n) || n <= 0) {
    throw new Error(`Expected positive number, got: ${value}`);
  }
  return n;
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}
