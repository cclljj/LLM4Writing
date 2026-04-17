package tw.com.slsinfo.essayai.chatroom;

import com.openai.client.OpenAIClientAsync;
import org.apache.wicket.Application;

import java.util.Optional;


/**
 * 小組WebSocket傳送所需資料Payload
 *
 * @param application
 * @param sessionId
 * @param openAIClientAsync
 * @param previousid
 * @param groupid
 */
public record WebSocketAIPayload(Application application, String sessionId, OpenAIClientAsync openAIClientAsync,
                                 Optional<String> previousid, Optional<Integer> groupid) {
}
