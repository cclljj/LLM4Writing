package tw.com.slsinfo.essayai.chatroom;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.models.GenreType;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.essayai.models.openai.OpenAITreeResponsePushMessage;
import tw.com.slsinfo.essayai.openai.OpenAIApiClientSingleton;
import tw.com.slsinfo.essayai.services.OpenAIWritingChatUpdaterService;
import tw.com.slsinfo.essayai.utils.AIConstants;

import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Consumer;


/**
 * OpenClass Session Index for Same OpenClassID - ocid
 */
@ApplicationScoped
public class SameClassMemberIndex {
    private static final Logger logger = LoggerFactory.getLogger(SameClassMemberIndex.class);
    /**
     * 相同開課班級的使用者Session
     */
    private final ConcurrentMap<Integer, Set<String>> SAME_OPEN_CLASS = new ConcurrentHashMap<>();
    @Inject
    private OpenAIWritingChatUpdaterService openAIWritingChatUpdaterService;

    /**
     * When User Enter Writing Session
     *
     * @param openClassId user's current open class
     * @param sessionId   user's session id
     */
    public void onWritingSession(int openClassId, String sessionId) {
        SAME_OPEN_CLASS.computeIfAbsent(openClassId,
                k -> ConcurrentHashMap.newKeySet()).add(sessionId);
        logger.debug("Add Writing Session : OpenClassId: {}, SessionId: {} . And Total Session Size : {}"
                , openClassId, sessionId, SAME_OPEN_CLASS.get(openClassId).size());
    }

    /**
     * When User Leave Writing Session
     *
     * @param openClassId user's current open class
     * @param sessionId   user's session id
     */
    public void offWritingSession(int openClassId, String sessionId) {
        SAME_OPEN_CLASS.computeIfAbsent(openClassId,
                k -> ConcurrentHashMap.newKeySet()).remove(sessionId);
        logger.debug("Leave Writing Session : OpenClassId: {}, SessionId: {} . And Total Session Size : {}"
                , openClassId, sessionId, SAME_OPEN_CLASS.get(openClassId).size());
    }

    public void removeSession(String sessionId) {
        SAME_OPEN_CLASS.forEach((id, session) ->
                SAME_OPEN_CLASS.get(id).remove(sessionId)
        );
    }

    /**
     * Check if User's Session is in same Open Class
     *
     * @param openClassId user's current open class
     * @param sessionId   user's session id
     */
    public boolean memberOf(int openClassId, String sessionId) {
        return SAME_OPEN_CLASS.get(openClassId).contains(sessionId);
    }

    /**
     * 送出下一步訊息給所有同開課內使用者
     *
     * @param eventSink
     */
    public void goNextStep(Consumer<ChatEvent> eventSink) {
        //AI回覆訊息
        eventSink.accept(new ChatEvent(0, ChatEventType.ALL_CLASS_MEMBER_GO_NEXT, Optional.empty(), null));
    }
}
