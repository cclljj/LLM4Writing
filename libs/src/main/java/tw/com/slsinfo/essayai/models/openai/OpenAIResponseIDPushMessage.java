package tw.com.slsinfo.essayai.models.openai;

import org.apache.wicket.protocol.ws.api.message.IWebSocketPushMessage;
import tw.com.slsinfo.essayai.utils.AIConstants;


/**
 * OpenAI Response Api response message id payload
 */
public class OpenAIResponseIDPushMessage implements IWebSocketPushMessage {
    private final AIResponseModel aiResponseModel;
    private final AIConstants.WEBSOCKET_MESSAGE_TYPE messageType;

    public OpenAIResponseIDPushMessage(AIResponseModel aiResponseModel, AIConstants.WEBSOCKET_MESSAGE_TYPE messageType) {
        this.aiResponseModel = aiResponseModel;
        this.messageType = messageType;
    }

    /**
     *
     * @param content
     * @param messageid
     * @param responseid
     */
    public OpenAIResponseIDPushMessage(String content, String messageid, String responseid, AIConstants.WEBSOCKET_MESSAGE_TYPE messageType) {
        this.aiResponseModel = new AIResponseModel(content, messageid, responseid);
        this.messageType = messageType;
    }

    /**
     * OpenAI Response Simple Payload
     *
     * @return
     */
    public AIResponseModel getAiResponseModel() {
        return aiResponseModel;
    }

    public AIConstants.WEBSOCKET_MESSAGE_TYPE getMessageType() {
        return messageType;
    }
}