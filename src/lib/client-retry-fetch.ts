export const CLIENT_FETCH_TIMEOUT_MS = 8000;
export const CLIENT_FETCH_RETRY_DELAYS_MS = [500, 1200];

export class ClientFetchError extends Error {
  status?: number;
  code: "http" | "network" | "timeout" | "parse";

  constructor(message: string, code: ClientFetchError["code"], status?: number) {
    super(message);
    this.name = "ClientFetchError";
    this.code = code;
    this.status = status;
  }
}

type FetchJsonOptions = {
  timeoutMs?: number;
  retryDelaysMs?: number[];
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isRetryableClientFetchError(error: unknown): boolean {
  if (!(error instanceof ClientFetchError)) return true;
  if (error.code === "network" || error.code === "timeout" || error.code === "parse") return true;
  return Boolean(error.status && (error.status === 429 || error.status >= 500));
}

export async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchJsonOptions = {}
): Promise<{ data: T; response: Response }> {
  const timeoutMs = options.timeoutMs ?? CLIENT_FETCH_TIMEOUT_MS;
  const retryDelaysMs = options.retryDelaysMs ?? CLIENT_FETCH_RETRY_DELAYS_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      const raw = await response.text();
      let data: T;
      try {
        data = raw ? (JSON.parse(raw) as T) : ({} as T);
      } catch {
        throw new ClientFetchError("client_json_parse_failed", "parse", response.status);
      }
      if (!response.ok) {
        const errorCode = typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : "client_request_failed";
        throw new ClientFetchError(errorCode, "http", response.status);
      }
      return { data, response };
    } catch (error) {
      const normalizedError =
        error instanceof ClientFetchError
          ? error
          : new ClientFetchError(
              error instanceof DOMException && error.name === "AbortError" ? "client_request_timeout" : "client_network_failed",
              error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network"
            );
      lastError = normalizedError;
      if (attempt >= retryDelaysMs.length || !isRetryableClientFetchError(normalizedError)) {
        throw normalizedError;
      }
      await sleep(retryDelaysMs[attempt]!);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new ClientFetchError("client_request_failed", "network");
}
