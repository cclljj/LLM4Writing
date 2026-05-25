const TAIPEI_TZ = "Asia/Taipei";

type DateTimeOptions = {
  withSeconds?: boolean;
  hour12?: boolean;
};

function normalizeFormattedText(text: string): string {
  return text.replace(/[\u00A0\u2007\u2009\u202F]/g, " ");
}

export function formatTaipeiDateTime(iso: string, options: DateTimeOptions = {}): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  const { withSeconds = true, hour12 = false } = options;
  return normalizeFormattedText(new Intl.DateTimeFormat("zh-TW", {
    timeZone: TAIPEI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12,
  }).format(date));
}

export function formatTaipeiDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return normalizeFormattedText(new Intl.DateTimeFormat("zh-TW", {
    timeZone: TAIPEI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date));
}

export function formatTaipeiTime(iso: string, options: { withSeconds?: boolean; hour12?: boolean } = {}): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  const { withSeconds = true, hour12 = false } = options;
  return normalizeFormattedText(new Intl.DateTimeFormat("zh-TW", {
    timeZone: TAIPEI_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
    hour12,
  }).format(date));
}
