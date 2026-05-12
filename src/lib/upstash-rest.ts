type UpstashPipelineResult = { result?: unknown; error?: string };

function getUpstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
  if (!url || !token) return null;
  return { url, token };
}

function withTimeout(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function requestJson(path: string, body: unknown): Promise<unknown> {
  const cfg = getUpstashConfig();
  if (!cfg) throw new Error("upstash_not_configured");
  const response = await fetch(`${cfg.url}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    signal: withTimeout(1500)
  });
  if (!response.ok) {
    throw new Error(`upstash_http_${response.status}`);
  }
  return response.json();
}

export function isUpstashConfigured(): boolean {
  return Boolean(getUpstashConfig());
}

export async function upstashCommand<T>(command: Array<string | number>): Promise<T | null> {
  const payload = [command];
  const parsed = (await requestJson("/pipeline", payload)) as UpstashPipelineResult[];
  const first = parsed[0];
  if (!first || first.error) return null;
  return (first.result ?? null) as T | null;
}

export async function upstashPipeline(commands: Array<Array<string | number>>): Promise<UpstashPipelineResult[] | null> {
  const parsed = (await requestJson("/pipeline", commands)) as UpstashPipelineResult[];
  if (!Array.isArray(parsed)) return null;
  return parsed;
}
