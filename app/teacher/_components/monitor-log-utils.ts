// Shared helpers for the monitor dialogue log panels (#457).

import { getWorkflowStepOrderIndex } from "@/src/lib/course-workflow";
import type { CourseWorkflowStep } from "@/src/lib/types";

export type MonitorMessage = { id: string; role: string; userId?: string; step: number; text: string; at: string };

export function getStepsFromMessages(
  messages: Array<{ step: number }>,
  options?: { includeSteps?: number[]; workflowSteps?: CourseWorkflowStep[] }
): number[] {
  const steps = new Set(messages.map((m) => m.step));
  (options?.includeSteps ?? []).forEach((step) => steps.add(step));
  const workflowOwner = { workflowSteps: options?.workflowSteps ?? [] };
  return Array.from(steps).sort((a, b) => getWorkflowStepOrderIndex(workflowOwner, a) - getWorkflowStepOrderIndex(workflowOwner, b));
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
