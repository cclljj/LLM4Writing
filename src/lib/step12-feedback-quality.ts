import { hasFormalLlmQualityRisk } from "@/src/lib/llm-response";

export function getStep12FeedbackRiskReasons(text: string, step?: 1 | 2, substepKey?: string): string[] {
  const reasons: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) reasons.push("empty_feedback");
  if (/^已收到大家的回覆[，、].*請繼續下一題[。！!]?$/.test(trimmed)) reasons.push("generic_feedback_template");
  if (/^已收到.*回覆.*整理得很好.*下一題/.test(trimmed)) reasons.push("generic_feedback_template");
  if (/```|^\{+|\}+$/m.test(trimmed)) reasons.push("json_shell_or_code_fence");
  if (/"feedback"|nextQuestion|\"question\"|json/i.test(trimmed)) reasons.push("json_key_leak");
  if (/請回答以下問題|nextQuestion|子步驟\s*\d-\d/.test(trimmed)) reasons.push("instruction_leak");
  if (/[，、：；]$/.test(trimmed)) reasons.push("incomplete_ending_punctuation");
  if (/(而且|並且|所以|但是|例如|像是|包含|以及)$/.test(trimmed)) reasons.push("incomplete_connective_ending");
  if (step === 1 && /(步驟\s*[二三]|第[二三]階段|蒐集資料|生成論點)/.test(trimmed)) reasons.push("mentions_future_stage_step1");
  if (step === 2 && /(步驟\s*三|第三階段|生成論點)/.test(trimmed)) reasons.push("mentions_future_stage_step2");
  const end = trimmed.at(-1) ?? "";
  const completeEnding = /[。！？.!?」』]$/.test(end);
  if (!completeEnding && trimmed.length >= 12) reasons.push("incomplete_sentence_ending");
  if (step === 2 && substepKey && ["2-2", "2-3", "2-4"].includes(substepKey)) {
    if (trimmed.length < 80) reasons.push("step2_late_substep_too_short");
    if (!/(重點|摘要|補強|建議|原因|例子|主張|素材|細節|說服力)/.test(trimmed)) reasons.push("step2_late_substep_missing_teaching_signals");
  }
  if (hasFormalLlmQualityRisk(trimmed)) reasons.push("formal_quality_risk");
  return Array.from(new Set(reasons));
}

export function isStep12FeedbackQualityRisk(text: string, step?: 1 | 2, substepKey?: string): boolean {
  return getStep12FeedbackRiskReasons(text, step, substepKey).length > 0;
}
