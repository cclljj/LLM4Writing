function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getDatabaseUrl(): string | undefined {
  return readEnv("SUPABASE_DB_URL") ?? readEnv("POSTGRES_URL") ?? readEnv("DATABASE_URL");
}

export function isDatabaseEnabled(): boolean {
  return Boolean(getDatabaseUrl());
}

export function useTransactionPooler(url?: string): boolean {
  const explicitMode = readEnv("SUPABASE_POOL_MODE");
  if (explicitMode === "transaction") return true;
  if (explicitMode === "session") return false;
  if (!url) return false;
  if (url.includes(":6543/")) return true;
  if (url.includes("pgbouncer=true")) return true;
  return false;
}

export function getPostgresClientOptions(url: string): {
  prepare: boolean;
  max: number;
  idle_timeout: number;
  connect_timeout: number;
} {
  const transactionPooler = useTransactionPooler(url);
  return {
    // Supabase transaction pooler does not support prepared statements.
    prepare: !transactionPooler,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10
  };
}
