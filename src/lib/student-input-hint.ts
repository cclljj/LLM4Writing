const GENERIC_HINT = "請先確認有直接回應題目重點，再補上至少一個具體想法或例子後重新送出。";

export function buildStudentInputHint(errorMessage: string): string {
  const msg = (errorMessage || "").trim();
  if (!msg) return GENERIC_HINT;

  if (msg.includes("太短")) {
    return "請把回答補成 1-2 句完整內容，至少包含「你的觀點 + 一個原因或例子」。";
  }
  if (msg.includes("隨機字串")) {
    return "請改用完整自然語句作答，不要輸入代碼、亂數字串或無意義字元。";
  }
  if (msg.includes("敷衍作答")) {
    return "請針對題目具體回答，避免只回「不知道／隨便」；可先寫你目前最接近的想法。";
  }
  if (msg.includes("題目本身") || msg.includes("太接近")) {
    return "請不要重貼題目，改用自己的話回答，並加入你自己的例子或解釋。";
  }
  if (msg.includes("至少") && msg.includes("項")) {
    return "請依題目要求補齊項目數，建議用換行或編號列出每一項。";
  }
  if (msg.includes("關聯性不足")) {
    return "請直接對準題目關鍵字作答，補上與題目相關的理由、例子或經驗。";
  }
  if (msg.includes("第") && msg.includes("題")) {
    return "請針對提示的題號補強內容，再重新送出整份回答。";
  }

  return GENERIC_HINT;
}

