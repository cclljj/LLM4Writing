package tw.com.slsinfo.essayai.models.openai;

import org.apache.wicket.protocol.ws.api.message.IWebSocketPushMessage;


/**
 * OpenAI Response Text Wrapper for Websocket Push Message
 */
@Deprecated
public class OpenAIResponsePushMessage implements IWebSocketPushMessage {
    private final String content;

    public OpenAIResponsePushMessage(String content) {
        this.content = content;
    }

    public String getContent() {
        return content;
    }
}
