export function shouldSyncOutlineFromSession(input: {
  localPendingOutline?: string | null;
  serverOutline: string;
  outlineDirty: boolean;
  draggingNodeId?: string | null;
  editingNodeId?: string | null;
}): boolean {
  if (input.outlineDirty || input.draggingNodeId || input.editingNodeId) return false;
  const pending = input.localPendingOutline?.trim() ?? "";
  if (!pending) return true;
  return input.serverOutline.trim() === pending;
}

export function resolvePendingOutlineAfterServerSync(input: {
  localPendingOutline?: string | null;
  serverOutline: string;
}): string | null {
  const pending = input.localPendingOutline?.trim() ?? "";
  if (!pending) return null;
  return input.serverOutline.trim() === pending ? null : input.localPendingOutline ?? null;
}
