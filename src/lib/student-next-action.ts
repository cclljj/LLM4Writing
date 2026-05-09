export type StudentNextActionInput = {
  currentStep: number;
  currentMode: "group_interaction" | "personal_interaction" | "non_interactive" | "personal_reflection";
  canReplyToQuestion: boolean;
  isSendingMessage: boolean;
  waitingAiForGroup: boolean;
  waitingGroupMembers: boolean;
  waitingGroupMemberNames: string[];
  step1CompletedWaitingTeacher: boolean;
  step2CompletedWaitingTeacher: boolean;
  step3CompletedByMe: boolean;
  waitingStep3Members: boolean;
  step4CompletedByMe: boolean;
  allStep4Completed: boolean;
  draftTextLength: number;
  unsavedDraftChars: number;
  step9AnsweredCount: number;
};

export type StudentNextAction = {
  tone: "focus" | "waiting" | "success";
  title: string;
  body: string;
  primaryAction: string;
  statusLabel: string;
};

function waitingNames(names: string[]): string {
  return names.length > 0 ? names.join("、") : "同組同學";
}

export function buildStudentNextAction(input: StudentNextActionInput): StudentNextAction {
  const hasAiWaitInThisStep = input.currentStep !== 4;
  if (input.isSendingMessage || (hasAiWaitInThisStep && input.waitingAiForGroup)) {
    return {
      tone: "waiting",
      title: "等待系統回覆",
      body: "系統正在整理下一題或回饋，請先停留在這一頁等待更新。",
      primaryAction: "等待更新",
      statusLabel: "處理中"
    };
  }

  if (input.step1CompletedWaitingTeacher) {
    return {
      tone: "success",
      title: "等待老師切換",
      body: "Step 1 已完成，請等待老師切換到 Step 2。",
      primaryAction: "等待下一步",
      statusLabel: "已完成"
    };
  }

  if (input.step2CompletedWaitingTeacher) {
    return {
      tone: "success",
      title: "等待老師切換",
      body: "Step 2 已完成，請等待老師切換到 Step 3。",
      primaryAction: "等待下一步",
      statusLabel: "已完成"
    };
  }

  if (input.waitingGroupMembers) {
    return {
      tone: "waiting",
      title: "等待組員",
      body: `你已完成目前任務，正在等待 ${waitingNames(input.waitingGroupMemberNames)}。`,
      primaryAction: "等待組員完成",
      statusLabel: "等待中"
    };
  }

  if (input.currentStep === 3) {
    if (input.step3CompletedByMe) {
      return {
        tone: input.waitingStep3Members ? "waiting" : "success",
        title: input.waitingStep3Members ? "等待組員" : "等待老師切換",
        body: input.waitingStep3Members ? "你已完成結構樹，請等待同組同學完成。" : "你已完成結構樹，請等待老師切換下一步。",
        primaryAction: input.waitingStep3Members ? "等待組員完成" : "等待下一步",
        statusLabel: input.waitingStep3Members ? "等待中" : "已完成"
      };
    }
    return {
      tone: "focus",
      title: "完成結構樹",
      body: "請編輯文章結構樹，至少放入主張、理由與例子，完成後按「完成結構樹」。",
      primaryAction: "完成結構樹",
      statusLabel: "輪到你"
    };
  }

  if (input.currentStep === 4) {
    if (input.allStep4Completed) {
      return {
        tone: "success",
        title: "等待老師切換",
        body: "全組已確認完成 Step 4，請等待老師切換到 Step 5。",
        primaryAction: "等待下一步",
        statusLabel: "已完成"
      };
    }
    if (input.step4CompletedByMe) {
      return {
        tone: "waiting",
        title: "等待組員",
        body: "你已確認完成 Step 4，正在等待同組同學確認。",
        primaryAction: "等待組員確認",
        statusLabel: "等待中"
      };
    }
    return {
      tone: "focus",
      title: "確認修正完成",
      body: "請先查看同學結構樹，修正自己的結構樹，完成後按「確認完成此步驟」。",
      primaryAction: "完成結構樹修正",
      statusLabel: "輪到你"
    };
  }

  if (input.currentStep === 6) {
    if (input.draftTextLength < 80) {
      return {
        tone: "focus",
        title: "撰寫初稿",
        body: "請先寫出初稿，至少完成開頭與一個理由段；儲存後再請 AI 給修改建議。",
        primaryAction: "完成初稿內容",
        statusLabel: "輪到你"
      };
    }
    return {
      tone: input.unsavedDraftChars > 0 ? "focus" : "success",
      title: input.unsavedDraftChars > 0 ? "儲存初稿" : "送出初稿",
      body: input.unsavedDraftChars > 0 ? "你的初稿有未儲存內容，請先按「儲存文章」。" : "初稿已儲存，可以請 AI 給修改建議，或完成文章撰寫進入下一步。",
      primaryAction: input.unsavedDraftChars > 0 ? "儲存文章" : "送出初稿",
      statusLabel: input.unsavedDraftChars > 0 ? "未保存" : "已保存"
    };
  }

  if (input.currentStep === 8) {
    return {
      tone: input.unsavedDraftChars > 0 ? "focus" : "success",
      title: input.unsavedDraftChars > 0 ? "儲存潤飾稿" : "送出最終稿",
      body: input.unsavedDraftChars > 0 ? "你有未儲存的潤飾內容，請先儲存文章。" : "請檢查潤飾後的文章，確認完成後按「完成潤飾步驟」。",
      primaryAction: input.unsavedDraftChars > 0 ? "儲存文章" : "送出最終稿",
      statusLabel: input.unsavedDraftChars > 0 ? "未保存" : "已保存"
    };
  }

  if (input.currentStep === 9) {
    return {
      tone: input.step9AnsweredCount >= 4 ? "success" : "focus",
      title: input.step9AnsweredCount >= 4 ? "送出反思" : "回答反思題",
      body: input.step9AnsweredCount >= 4 ? "四題反思都已填寫，請一次送出四題答案。" : "請依序完成四題個人反思，四題都填完後再一次送出。",
      primaryAction: input.step9AnsweredCount >= 4 ? "送出四題答案" : "完成四題反思",
      statusLabel: `${input.step9AnsweredCount}/4`
    };
  }

  if (input.currentStep === 10) {
    return {
      tone: "success",
      title: "閱讀總結報告",
      body: "課程已完成，請閱讀總結報告並等待老師後續指示。",
      primaryAction: "閱讀報告",
      statusLabel: "已完成"
    };
  }

  if (input.currentMode === "non_interactive") {
    return {
      tone: "waiting",
      title: "閱讀系統整理",
      body: "本步驟由系統整理資料，請閱讀畫面上的報告並等待自動進入下一步。",
      primaryAction: "閱讀報告",
      statusLabel: "整理中"
    };
  }

  if (input.canReplyToQuestion) {
    return {
      tone: "focus",
      title: "回答這一題",
      body: "請先回答目前系統提問，送出後再等待同組同學或 AI 回饋。",
      primaryAction: "回答這一題",
      statusLabel: "輪到你"
    };
  }

  return {
    tone: "waiting",
    title: "等待下一步",
    body: "請留在目前步驟，等待系統、同組同學或老師更新下一個動作。",
    primaryAction: "等待更新",
    statusLabel: "等待中"
  };
}
