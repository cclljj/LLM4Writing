export function shouldTreatAsZipDownload(input: {
  ok: boolean;
  contentType: string | null | undefined;
}): boolean {
  if (!input.ok) return false;
  const contentType = (input.contentType ?? "").toLowerCase();
  return contentType.includes("application/zip");
}
