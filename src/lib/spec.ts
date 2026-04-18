import { InteractionMode, StepDefinition } from "@/src/lib/types";

export const STEP_DEFINITIONS: StepDefinition[] = [
  { step: 1, name: "審視題目", mode: "group_interaction" },
  { step: 2, name: "蒐集資料", mode: "group_interaction" },
  { step: 3, name: "生成論點", mode: "personal_interaction" },
  { step: 4, name: "對比修正", mode: "group_interaction" },
  { step: 5, name: "摘要報告", mode: "non_interactive" },
  { step: 6, name: "撰寫初稿", mode: "personal_interaction" },
  { step: 7, name: "分析回饋", mode: "non_interactive" },
  { step: 8, name: "修改潤飾", mode: "personal_interaction" },
  { step: 9, name: "個人反思", mode: "personal_reflection" },
  { step: 10, name: "總結報告", mode: "non_interactive" }
];

export const REFLECTION_QUESTIONS = [
  "這次寫作任務中，你最滿意的部分是什麼？",
  "哪一個步驟對你最有幫助，為什麼？",
  "你在論點或結構上遇到過什麼困難？",
  "下次你會如何調整自己的寫作策略？"
];

export function getModeByStep(step: number): InteractionMode {
  return STEP_DEFINITIONS.find((s) => s.step === step)?.mode ?? "personal_interaction";
}

export function getStepName(step: number): string {
  return STEP_DEFINITIONS.find((s) => s.step === step)?.name ?? "未知步驟";
}
