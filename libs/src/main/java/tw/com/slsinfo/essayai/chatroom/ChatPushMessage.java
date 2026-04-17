package tw.com.slsinfo.essayai.chatroom;

import org.apache.wicket.protocol.ws.api.message.IWebSocketPushMessage;

/**
 * 群組討論自訂WebSocket Push Message
 */
public class ChatPushMessage implements IWebSocketPushMessage {
    private final ChatEvent chatEvent;

    public ChatPushMessage(ChatEvent chatEvent) {
        this.chatEvent = chatEvent;
    }

    public ChatEvent getChatEvent() {
        return chatEvent;
    }
}
