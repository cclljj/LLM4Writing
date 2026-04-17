package tw.com.slsinfo.essayai.chatroom;

/**
 * 小組討論事件，用來判定小組成績是否加入等事件
 */
public enum ChatEventType {

    MEMBER_JOINED("小組成員加入"),
    USER_ENTER_PERSONAL_PHASE("使用者進入個人學習"),
    ALL_CLASS_MEMBER_GO_NEXT("班級所有成員直接往下一階段"),
    MEMBER_LEAVE("小組成員離開"),
    GROUP_MEMBER_READY_GO_TO_NEXT_PHASE("小組成員準備往下一階段"),
    PERSONAL_READY_GO_TO_NEXT_PHASE("使用者準備往下一階段"),
    GROUP_MEMBER_GO_TO_NEXT_PHASE("小組成員往下一階段"),
    GEN_FIRST_CHAT_MSG_ID("產生第一次對話ID"),
    HAS_PREVIOUS_CHAT_MSG_ID("已有先前對話ID"),
    WAITING_GEN_MSG_ID("等待產生第一次對話ID"),
    GROUP_FIRST_TIME_AI_RESPONSE("小組對話AI第一次回覆"),
    PHASE_OPENING("開頭詞"),
    GROUP_GENERATED_FIRST_TIME_AI_RESPONSE("小組對話AI第一次回覆已產生"),
    GENERATED_OPENING("開頭詞回覆已產生"),
    PERSONAL_GENERATED_FIRST_TIME_AI_RESPONSE("個人AI第一次回覆已產生"),
    GROUP_PENDING_FIRST_TIME_AI_RESPONSE("小組對話產生第一次AI回覆中"),
    GROUP_PENDING_FIRST_TIME_AI_QUESTION_RESPONSE("小組對話產生第一次AI問題回覆中"),
    OPENING_PENDING("等待開頭詞回覆中"),
    PERSONAL_PENDING_FIRST_TIME_AI_RESPONSE("小組對話產生第一次AI回覆中"),
    PENDING_AI_JUDGE_RESPONSE("等待AI作文評分中"),
    GROUP_PENDING_AI_RESPONSE("送出小組對話等待AI回覆中"),
    P1_GROUP_PENDING_AI_RESPONSE("Phase1送出小組對話等待AI回覆中"),
    PERSONAL_PENDING_AI_RESPONSE("送出對話等待AI回覆中"),
    GROUP_PENDING_AI_SUMMARY("等待AI摘要中"),
    PERSONAL_PENDING_AI_SUMMARY("等待AI摘要中"),
    GROUP_PENDING_AI_TREE_JSON("等待AI Tree JSON中"),
    GROUP_MESSAGE_COLLECTING("小組對話蒐集中"),
    GROUP_AI_RESPONSE("小組對話產生AI回覆"),
    GROUP_AI_FIRST_QUESTION_RESPONSE("小組對話第一則問題"),
    P1_GROUP_AI_RESPONSE("Phase1小組對話產生AI回覆"),
    REACH_MIN_CHAT_TURNS("已到達最小群組對話輪迴"),
    PERSONAL_AI_RESPONSE("個人對話產生AI回覆"),
    AI_JUDGE_RESPONSE("AI產生作文評分回覆"),
    GROUP_AI_SUMMARY("群組AI摘要"),
    PERSONAL_AI_SUMMARY("AI摘要"),
    GROUP_AI_TREE_JSON("AI Tree Json"),
    PERSONAL_AI_TREE_JSON("PersonalAI Tree Json"),
    CANNOT_GEN_TREE("無法產生結構樹"),
    GROUP_AI_CHAT_RESTART("重新開始對話"),
    GROUP_MEMBER_NEW_MESSAGE("小組成員PO文"),
    PERSONAL_NEW_MESSAGE("使用者PO文"),
    GROUP_MEMBER_DO_SUMMARY("送出AI摘要"),
    PERSONAL_DO_SUMMARY("個人送出AI摘要"),
    GROUP_MEMBER_DO_TREE("送出AI Tree Prompt"),
    ALL_READY("全員到齊"),
    REACH_DEADLINE("等待時間已到"),
    REACH_QUORUM("可進行下一動作最小人數已達到"),
    MEMBER_LOWER("小組成員不足"),
    CHAT_STARTED("小組討論已開始"),
    SEND_MESSAGE_TO_AI("訊息送至AI"),
    AI_SUMMARY("AI進行回覆");

    final String ref;

    ChatEventType(String ref) {
        this.ref = ref;
    }

    public String getRef() {
        return ref;
    }
}
