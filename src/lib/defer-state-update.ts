export function deferStateUpdate(update: () => void): void {
  queueMicrotask(update);
}
