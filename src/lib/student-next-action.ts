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
};

function waitingNames(names: string[]): string {
  return names.length > 0 ? names.join("、") : "同組同學";
}

export function buildStudentNextAction(input: StudentNextActionInput): StudentNextAction {
  if (input.isSendingMessage || input.waitingAiForGroup) {
    return {
      tone: "waiting",
      title: "現在請你做",
      body: "系統正在整理下一題或回饋，請先停留在這一頁等待更新。"
    };
  }

  if (input.step1CompletedWaitingTeacher) {
    return {
      tone: "success",
      title: "現在請你做",
      body: "Step 1 已完成，請等待老師切換到 Step 2。"
    };
  }

  if (input.step2CompletedWaitingTeacher) {
    return {
      tone: "success",
      title: "現在請你做",
      body: "Step 2 已完成，請等待老師切換到 Step 3。"
    };
  }

  if (input.waitingGroupMembers) {
    return {
      tone: "waiting",
      title: "現在請你做",
      body: `你已完成目前任務，正在等待 ${waitingNames(input.waitingGroupMemberNames)}。`
    };
  }

  if (input.currentStep === 3) {
    if (input.step3CompletedByMe) {
      return {
        tone: input.waitingStep3Members ? "waiting" : "success",
        title: "現在請你做",
        body: input.waitingStep3Members ? "你已完成結構樹，請等待同組同學完成。" : "你已完成結構樹，請等待老師切換下一步。"
      };
    }
    return {
      tone: "focus",
      title: "現在請你做",
      body: "請編輯文章結構樹，至少放入主張、理由與例子，完成後按「完成結構樹」。"
    };
  }

  if (input.currentStep === 4) {
    if (input.allStep4Completed) {
      return {
        tone: "success",
        title: "現在請你做",
        body: "全組已確認完成 Step 4，請等待老師切換到 Step 5。"
      };
    }
    if (input.step4CompletedByMe) {
      return {
        tone: "waiting",
        title: "現在請你做",
        body: "你已確認完成 Step 4，正在等待同組同學確認。"
      };
    }
    return {
      tone: "focus",
      title: "現在請你做",
      body: "請先查看同學結構樹，修正自己的結構樹，完成後按「確認完成此步驟」。"
    };
  }

  if (input.currentStep === 6) {
    if (input.draftTextLength < 80) {
      return {
        tone: "focus",
        title: "現在請你做",
        body: "請先寫出初稿，至少完成開頭與一個理由段；儲存後再請 AI 給修改建議。"
      };
    }
    return {
      tone: input.unsavedDraftChars > 0 ? "focus" : "success",
      title: "現在請你做",
      body: input.unsavedDraftChars > 0 ? "你的初稿有未儲存內容，請先按「儲存文章」。" : "初稿已儲存，可以請 AI 給修改建議，或完成文章撰寫進入下一步。"
    };
  }

  if (input.currentStep === 8) {
    return {
      tone: input.unsavedDraftChars > 0 ? "focus" : "success",
      title: "現在請你做",
      body: input.unsavedDraftChars > 0 ? "你有未儲存的潤飾內容，請先儲存文章。" : "請檢查潤飾後的文章，確認完成後按「完成潤飾步驟」。"
    };
  }

  if (input.currentStep === 9) {
    return {
      tone: input.step9AnsweredCount >= 4 ? "success" : "focus",
      title: "現在請你做",
      body: input.step9AnsweredCount >= 4 ? "四題反思都已填寫，請一次送出四題答案。" : "請依序完成四題個人反思，四題都填完後再一次送出。"
    };
  }

  if (input.currentStep === 10) {
    return {
      tone: "success",
      title: "現在請你做",
      body: "課程已完成，請閱讀總結報告並等待老師後續指示。"
    };
  }

  if (input.currentMode === "non_interactive") {
    return {
      tone: "waiting",
      title: "現在請你做",
      body: "本步驟由系統整理資料，請閱讀畫面上的報告並等待自動進入下一步。"
    };
  }

  if (input.canReplyToQuestion) {
    return {
      tone: "focus",
      title: "現在請你做",
      body: "請先回答目前系統提問，送出後再等待同組同學或 AI 回饋。"
    };
  }

  return {
    tone: "waiting",
    title: "現在請你做",
    body: "請留在目前步驟，等待系統、同組同學或老師更新下一個動作。"
  };
}
