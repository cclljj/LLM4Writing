// Shared helpers for the monitor dialogue log panels (#457).

export type MonitorMessage = { id: string; role: string; userId?: string; step: number; text: string; at: string };

export function getStepsFromMessages(messages: Array<{ step: number }>): number[] {
  return Array.from(new Set(messages.map((m) => m.step))).sort((a, b) => a - b);
}

export function getPersonalScopedMessagesForStudentHistory(
  messages: MonitorMessage[],
  username: string
): MonitorMessage[] {
  return messages.filter((m) => {
    if (m.role === "student") return m.userId === username;
    if (m.role === "ai") return !m.userId || m.userId === username;
    if (m.role === "system") return !m.userId || m.userId === username;
    return false;
  });
}
