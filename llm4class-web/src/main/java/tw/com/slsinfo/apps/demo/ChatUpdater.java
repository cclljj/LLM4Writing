package tw.com.slsinfo.apps.demo;


import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.Application;
import org.apache.wicket.protocol.ws.WebSocketSettings;
import org.apache.wicket.protocol.ws.api.WebSocketPushBroadcaster;
import org.apache.wicket.protocol.ws.api.message.IWebSocketPushMessage;
import org.apache.wicket.protocol.ws.api.registry.PageIdKey;

import java.io.Serializable;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 範例類別會定期push對話內容到Page
 */
public class ChatUpdater {

    private static final Logger logger = LogManager.getLogger(ChatUpdater.class);

    /**
     * Marks a page as a listener to chat update
     */
    public interface IChatListener {

    }

    public static ChatUpdaterTask start(Application application, String session, ScheduledExecutorService scheduledExecutorService) {
        // create an asynchronous task that will write the data to the client
        ChatUpdaterTask chatUpdaterTask = new ChatUpdaterTask(application, session);
        scheduledExecutorService.schedule(chatUpdaterTask, 10, TimeUnit.SECONDS);
        return chatUpdaterTask;
    }

    public record ChatMessage(String message) implements IWebSocketPushMessage {
    }

    public static class ChatUpdaterTask implements Runnable, Serializable {
        /**
         * The following fields are needed to be able to lookup the IWebSocketConnection from
         * IWebSocketConnectionRegistry
         */
        private final String applicationName;
        private final String sessionId;

        public ChatUpdaterTask(Application application, String sessionId) {
            this.applicationName = application.getName();
            this.sessionId = sessionId;
        }

        @Override
        public void run() {
            Application application = Application.get(applicationName);
            WebSocketSettings webSocketSettings = WebSocketSettings.Holder.get(application);
            int messages = 0;
            while (messages < 10) {
                try {
                    WebSocketPushBroadcaster webSocketPushBroadcaster =
                            new WebSocketPushBroadcaster(webSocketSettings.getConnectionRegistry());
                    webSocketPushBroadcaster.broadcastAllMatchingFilter(application,
                            (sessionId, key) -> ChatUpdaterTask.this.sessionId.equals(sessionId)
                                    && key instanceof PageIdKey, new ChatMessage("這是測試".concat(String.valueOf(messages + 1))));

                    TimeUnit.SECONDS.sleep(5);
                    messages++;
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    e.printStackTrace();
                    break;
                }
            }
        }
    }

}
