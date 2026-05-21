import { hasFormalLlmQualityRisk } from "@/src/lib/llm-response";

export function isStep12FeedbackQualityRisk(text: string, step?: 1 | 2, substepKey?: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^已收到大家的回覆[，、].*請繼續下一題[。！!]?$/.test(trimmed)) return true;
  if (/^已收到.*回覆.*整理得很好.*下一題/.test(trimmed)) return true;
  if (/```|^\{+|\}+$/m.test(trimmed)) return true;
  if (/"feedback"|nextQuestion|\"question\"|json/i.test(trimmed)) return true;
  if (/[？?]/.test(trimmed)) return true;
  if (/請回答以下問題|nextQuestion|子步驟\s*\d-\d/.test(trimmed)) return true;
  if (/[，、：；]$/.test(trimmed)) return true;
  if (/(而且|並且|所以|但是|例如|像是|包含|以及)$/.test(trimmed)) return true;
  if (step === 1 && /(步驟\s*[二三]|第[二三]階段|蒐集資料|生成論點)/.test(trimmed)) return true;
  if (step === 2 && /(步驟\s*三|第三階段|生成論點)/.test(trimmed)) return true;
  const end = trimmed.at(-1) ?? "";
  const completeEnding = /[。！？.!?」』]$/.test(end);
  if (!completeEnding && trimmed.length >= 12) return true;
  if (step === 2 && substepKey && ["2-2", "2-3", "2-4"].includes(substepKey)) {
    if (trimmed.length < 80) return true;
    if (!/(重點|摘要|補強|建議|原因|例子|主張|素材|細節|說服力)/.test(trimmed)) return true;
  }
  return hasFormalLlmQualityRisk(trimmed);
}
