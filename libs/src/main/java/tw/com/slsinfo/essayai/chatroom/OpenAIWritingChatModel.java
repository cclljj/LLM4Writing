package tw.com.slsinfo.essayai.chatroom;

import com.openai.client.OpenAIClientAsync;
import org.apache.wicket.Application;

import java.util.Optional;

/**
 * 群聊時WebSocket訊息
 *
 * @param application
 * @param sessionId
 * @param openAIClientAsync
 * @param usermessage
 * @param previousid
 * @param groupid
 */
public record OpenAIWritingChatModel(Application application, String sessionId, OpenAIClientAsync openAIClientAsync,
                                     String usermessage, Optional<String> previousid, Optional<Integer> groupid) {
}
