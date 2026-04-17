package tw.com.slsinfo.essayai.chatroom;

import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.wicket.Application;
import org.apache.wicket.protocol.ws.WebSocketSettings;
import org.apache.wicket.protocol.ws.api.IWebSocketConnection;
import org.apache.wicket.protocol.ws.api.WebSocketPushBroadcaster;
import org.apache.wicket.protocol.ws.api.registry.IWebSocketConnectionRegistry;
import org.apache.wicket.protocol.ws.api.registry.PageIdKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Collection;
import java.util.Optional;
import java.util.concurrent.ExecutorService;


/**
 * 專門用來處理小組AI對話以及等待訊息
 */
@ApplicationScoped
public class GroupChatBroadcaster {

    private static final Logger logger = LoggerFactory.getLogger(GroupChatBroadcaster.class);
    private WebSocketPushBroadcaster webSocketPushBroadcaster;
    @Resource(lookup = "java:comp/DefaultManagedExecutorService")
    private ExecutorService executorService;


    /**
     * 推送訊息到等待區或是群組討論區
     *
     * @param application
     * @param groupid
     * @param chatGroupRegistry
     * @param chatEvent
     */
    public void publishToGroup(Application application, Optional<Integer> groupid, ChatGroupRegistry chatGroupRegistry, ChatEvent chatEvent) {
        logger.debug("Before publishToGroup(webSocketAIPayload, groupState, chatEvent);");
        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();

        IWebSocketConnectionRegistry.IConnectionsFilter filter = new GroupIKeyConnectionsFilter(
                groupid, chatGroupRegistry);

        Collection<IWebSocketConnection> connections
                = iWebSocketConnectionRegistry.getConnections(application, filter);

        if (logger.isDebugEnabled()) {
            connections.forEach(connection -> {
                logger.debug("User Connection : {} , Context : {} ", connection.getSessionId(), connection.getKey().getContext());
            });
        }


        webSocketPushBroadcaster = new
                WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        webSocketPushBroadcaster.
                broadcastAllMatchingFilter(
                        application,
                        filter,
                        new ChatPushMessage(chatEvent)
                );
        logger.debug("After publishToGroup(webSocketAIPayload, groupState, chatEvent);");
    }

    /**
     * WebSocket push to all class members
     *
     * @param application
     * @param sessionId
     * @param ocid
     * @param chatEvent
     */
    public void publishToAllClassMembers(Application application, Integer ocid, SameClassMemberIndex sameClassMemberIndex, ChatEvent chatEvent) {
        logger.debug(" publishToUser");
        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();
        IWebSocketConnectionRegistry.IConnectionsFilter filter = new OpenClassIKeyConnectionsFilter(ocid, sameClassMemberIndex);

        Collection<IWebSocketConnection> connections
                = iWebSocketConnectionRegistry.getConnections(application, filter);


        connections.forEach(connection -> {
            logger.debug("Personal User Connection : {} , Context : {} ", connection.getSessionId(), connection.getKey().getContext());
        });


        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                application,
                filter,
                new ChatPushMessage(chatEvent)
        );
        logger.debug("After publishToGroup(webSocketAIPayload, groupState, chatEvent);");
    }


    /**
     * WebSocket push to specific user
     *
     * @param application
     * @param sessionId
     * @param chatEvent
     */
    public void publishToUser(Application application, String sessionId, ChatEvent chatEvent) {
        logger.debug(" publishToUser");
        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();
        IWebSocketConnectionRegistry.IConnectionsFilter filter = (session, key) ->
                key instanceof PageIdKey && sessionId.equals(session);

        Collection<IWebSocketConnection> connections
                = iWebSocketConnectionRegistry.getConnections(application, filter);


        connections.forEach(connection -> {
            logger.debug("Personal User Connection : {} , Context : {} ", connection.getSessionId(), connection.getKey().getContext());
        });


        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                application,
                filter,
                new ChatPushMessage(chatEvent)
        );
        logger.debug("After publishToGroup(webSocketAIPayload, groupState, chatEvent);");
    }
}
