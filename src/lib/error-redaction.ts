const POSTGRES_URL_PATTERN = /\bpostgres(?:ql)?:\/\/\S+/gi;

export function redactConnectionStrings(value: string): string {
  return value.replace(POSTGRES_URL_PATTERN, "postgres://[redacted]");
}

export function safeErrorDetail(error: unknown, maxLength = 180): string {
  let message = "unknown";
  if (error instanceof Error) {
    message = error.message || "error";
  } else if (typeof error === "string") {
    message = error;
  }
  return redactConnectionStrings(message).slice(0, maxLength);
}

export function clientSafeErrorDetail(
  error: unknown,
  options: { isProduction: boolean; genericProductionDetail: string; maxLength?: number }
): string {
  if (options.isProduction) return options.genericProductionDetail;
  return safeErrorDetail(error, options.maxLength);
}
