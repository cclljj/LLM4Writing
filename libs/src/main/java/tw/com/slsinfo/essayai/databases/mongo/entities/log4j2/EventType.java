package tw.com.slsinfo.essayai.databases.mongo.entities.log4j2;

import java.util.Arrays;
import java.util.List;

/**
 * 事件類型
 */
public enum EventType {


    IMPORT("匯入"),
    LOGIN("登入"),
    LOGOUT("登出"),
    POST("發表"),
    USER_SUMMARY_PROMPT("使用者總結訊息"),
    USER_CLICK_SUMMARY("使用者按了總結訊息鈕"),
    GROUP_USER_TREE_PROMPT("小組產生結構樹"),
    USER_CONTINUE_PROMPT("繼網進行前次的對話"),
    SET_SYSTEM_PROMPT("設定AI系統角色"),
    SET_MESSAGE_ID("取得AI回應ID"),
    USER_PROMPT("送給AI的USER PROMPT"),
    READY_TO_SEND_PROMPT("準備送出prompt"),
    READY_TO_SEND_TREE_PROMPT("準備送出結構樹prompt"),
    READY_TO_SEND_JUDGE_COMPOSE("準備送出作文評分Prompt"),
    GOT_AI_RESPONSE("收到AI回覆"),
    GOT_AI_TREE_RESPONSE("收到AI結構樹回覆"),
    GOT_AI_JUDGE_RESPONSE("收到AI作文評分回覆"),
    FETCH_TOKEN("獲取Token"),
    INVOKE_API("呼叫API"),
    INVOKE_LLM_API("呼叫LLM API"),
    SYSTEM_PROMPTS("AI回覆訊息"),
    CLIENT_GOT_AI_RESPONSE("用戶端接收到AI回覆訊息"),
    LLM_PROMPTS("LLM Prompt"),
    LLM_RESPONSE("LLM Response"),
    USER_AUDIO_PROMPT("使用者語音訊息"),
    USER_AUDIO_TRANSCRIPT("使用者語音訊息轉文字"),
    COMMENT("註記"),
    REPLY("回覆"),
    CREATE("新增"),
    MODIFY("修改"),
    DELETE("刪除"),
    QUERY("查詢"),
    CLICK("點擊"),
    DOUBLE_CLICK("雙點擊"),
    SET_TREE_JSON_PROMPT("結構樹Json"),
    SET_ARTICLE_JUDGE_PROMPT("AI作文評分"),
    PRIVILEGED("特權事件");

    /**
     * 事件類型文字說明
     */
    String name;

    EventType(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }

    public static List<EventType> stream() {
        return Arrays.stream(EventType.values()).toList();
    }


}
