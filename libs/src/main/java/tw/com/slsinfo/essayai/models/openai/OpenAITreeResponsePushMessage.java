package tw.com.slsinfo.essayai.models.openai;

import org.apache.wicket.protocol.ws.api.message.IWebSocketPushMessage;


/**
 * 結構樹Json
 */
public class OpenAITreeResponsePushMessage implements IWebSocketPushMessage {
    private final String json;
    private final String messageid;
    private final String responseid;

    /**
     *
     * @param json       結構樹
     * @param messageid  新MSGID
     * @param responseid 前次MSGID
     */
    public OpenAITreeResponsePushMessage(String json, String messageid, String responseid) {
        this.json = json;
        this.messageid = messageid;
        this.responseid = responseid;
    }


    public String getJson() {
        return json;
    }

    public String getMessageid() {
        return messageid;
    }

    public String getResponseid() {
        return responseid;
    }

    @Override
    public String toString() {
        return "OpenAITreeResponsePushMessage{" +
                "json='" + json + '\'' +
                ", messageid='" + messageid + '\'' +
                ", responseid='" + responseid + '\'' +
                '}';
    }
}
