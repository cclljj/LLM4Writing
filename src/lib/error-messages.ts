const errorMessages: Record<string, string> = {
  activities_load_failed: "課程資料暫時載入失敗。建議：請稍後再試，或重新整理頁面。",
  auth_not_ready: "登入狀態尚未準備完成。建議：請稍等幾秒後再試。",
  complete_step3_failed: "結構樹送出失敗。建議：請重新按一次完成；若仍失敗，請重新整理頁面。",
  complete_step4_failed: "Step 4 完成確認失敗。建議：請稍後再試，或請老師確認課程狀態。",
  complete_makeup_outline_failed: "個人結構圖補做送出失敗。建議：請重新按一次完成；若仍失敗，請重新整理頁面。",
  course_ended: "課程已結束，無法再進入討論。建議：如需補做，請聯繫教師。",
  course_lifecycle_failed: "課程狀態更新失敗。建議：請稍後再試，或重新整理學習管理頁。",
  course_not_started: "課程尚未開始。建議：請等待老師開始上課後再進入討論。",
  course_paused: "課程目前暫停中。建議：請等待老師繼續上課後再操作。",
  delete_activity_failed: "課程刪除失敗。建議：請確認權限後再試，或聯繫系統管理員。",
  forbidden: "目前帳號沒有執行此操作的權限。建議：請確認登入身分，或聯繫教師。",
  history_fetch_failed: "歷史紀錄載入失敗。建議：請稍後再試或重新整理頁面。",
  invalid_step: "目前步驟狀態不一致。建議：請重新整理頁面後再試。",
  join_failed: "進入課程失敗。建議：請確認課程已開始，或請教師檢查分組名單。",
  login_rate_limit_dependency_unavailable: "登入安全檢查暫時不可用。建議：請系統管理員確認 Upstash Redis 設定，或關閉嚴格分散式登入鎖定模式。",
  monitor_detail_load_failed: "對話詳情載入失敗。建議：請稍後再點一次查看。",
  monitor_load_failed: "監控資料載入失敗。建議：系統會自動重試，你也可以手動重新整理。",
  makeup_outline_not_required: "目前不需要補個人結構圖。建議：請重新整理頁面確認最新進度。",
  makeup_outline_required: "請先完成個人結構圖補做，再進入正式寫作。",
  not_group_member: "你尚未被分配到此課程小組。建議：請向老師確認分組設定。",
  overview_failed: "課程總覽載入失敗。建議：請稍後再試或重新整理頁面。",
  progress_failed: "個人進度載入失敗。建議：請稍後再點一次查看。",
  research_export_hash_salt_missing: "研究資料匯出暫時不可用。建議：請系統管理員設定 RESEARCH_EXPORT_HASH_SALT 後再試。",
  save_failed: "內容儲存失敗。建議：請先不要關閉頁面，稍後再按一次儲存。",
  send_failed: "答案送出失敗。建議：請檢查內容後再送一次。",
  session_not_found: "找不到這個課程討論紀錄。建議：請重新進入課程，或請教師確認課程狀態。",
  step3_stream_failed: "Step 3 AI 回覆暫時失敗。建議：請稍後再送一次問題。",
  step3_default_outline_unavailable: "目前無法載入結構樹範本。建議：請重新整理，或請老師確認課程設定。",
  step3_outline_depth3_not_edited: "請先把第三層（含）以後的節點都修改成你自己的內容，再按完成。",
  step5_auto_advance_failed: "摘要完成後自動切換失敗。建議：請重新整理頁面，或請老師協助切換。",
  step6_complete_failed: "初稿送出失敗。建議：請依提示補強文章後再試。",
  step6_suggest_failed: "AI 修改建議暫時無法產生。建議：請稍後再試，或先自行修改文章。",
  step8_complete_failed: "最終稿送出失敗。建議：請確認文章已儲存後再試。",
  student_join_failed: "進入課程失敗。建議：請重新整理後再試，或請教師確認課程設定。",
  switch_failed: "步驟切換失敗。建議：請稍後再試，或重新整理監控資料。"
};

function normalizeError(raw: unknown): string {
  if (raw instanceof Error) return raw.message;
  if (typeof raw === "string") return raw;
  return "";
}

function looksTechnical(message: string): boolean {
  return /^[a-z0-9_:-]+$/i.test(message.trim()) || message.includes("_failed");
}

export function formatUserError(raw: unknown, fallback = "操作未完成。建議：請稍後再試，或重新整理頁面。"): string {
  const message = normalizeError(raw).trim();
  if (!message) return fallback;
  if (errorMessages[message]) return errorMessages[message];
  if (!looksTechnical(message)) return message;
  return fallback;
}

export function appendErrorHint(raw: unknown, hint?: string, fallback?: string): string {
  const base = formatUserError(raw, fallback);
  const cleanHint = hint?.trim();
  return cleanHint ? `${base}｜建議修改：${cleanHint}` : base;
}
