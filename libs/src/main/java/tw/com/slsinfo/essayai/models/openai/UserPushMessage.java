package tw.com.slsinfo.essayai.models.openai;

import org.apache.wicket.protocol.ws.api.message.IWebSocketPushMessage;


/**
 * 使用者推送的訊息，用來更新前端使用者頁面
 */
public class UserPushMessage implements IWebSocketPushMessage {
    private final String content;

    public UserPushMessage(String content) {
        this.content = content;
    }

    public String getContent() {
        return content;
    }
}
