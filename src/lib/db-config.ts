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
