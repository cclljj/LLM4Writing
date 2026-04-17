package tw.com.slsinfo.essayai.services;

import com.openai.client.OpenAIClientAsync;
import com.openai.models.ChatModel;
import com.openai.models.audio.AudioModel;
import com.openai.models.audio.transcriptions.TranscriptionCreateParams;
import com.openai.models.responses.ResponseCreateParams;
import com.openai.models.responses.ResponseInputItem;
import com.openai.models.responses.ResponseOutputText;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.Application;
import org.apache.wicket.protocol.ws.WebSocketSettings;
import org.apache.wicket.protocol.ws.api.IWebSocketConnection;
import org.apache.wicket.protocol.ws.api.WebSocketPushBroadcaster;
import org.apache.wicket.protocol.ws.api.registry.IWebSocketConnectionRegistry;
import org.apache.wicket.protocol.ws.api.registry.PageIdKey;
import tw.com.slsinfo.essayai.models.openai.OpenAIResponseIDPushMessage;
import tw.com.slsinfo.essayai.models.openai.OpenAIResponsePushMessage;
import tw.com.slsinfo.essayai.models.openai.UserPushMessage;
import tw.com.slsinfo.essayai.openai.LLM4ClassTokenLoaderSingleton;
import tw.com.slsinfo.essayai.utils.AIConstants;

import java.io.File;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;


/**
 * 使用者送出prompt後，會以背景執行緒呼叫API，並等待AI思考，取得回應後再以WebSocket方式送回前端並由Wicket Page進行頁面更新
 */
@ApplicationScoped
public class OpenAIClassChatUpdaterService {

    private static final Logger logger = LogManager.getLogger(OpenAIClassChatUpdaterService.class);
    private String apiKey;
    private String systemPrompt;
    private WebSocketPushBroadcaster webSocketPushBroadcaster;

    @PostConstruct
    void init() {
        apiKey = LLM4ClassTokenLoaderSingleton.INSTANCE.getToken();
        systemPrompt = LLM4ClassTokenLoaderSingleton.INSTANCE.getToken();
    }


    /**
     * 送出Async System Prompt
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync connection pooling and thread pool, have to create in Application level
     * @param usermessage       使用者輸入的問題
     * @param previousid        先前的對話ID，用以延續
     */
    public void doSendAsyncUserPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, String usermessage, String previousid) {

        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();
        List<ResponseInputItem> inputs = new ArrayList<>();

        inputs.add(ResponseInputItem.ofMessage(ResponseInputItem.Message.builder()
                .addInputTextContent(usermessage)
                .role(ResponseInputItem.Message.Role.USER)
                .build()));
        ResponseCreateParams responseCreateParams = ResponseCreateParams.builder()
                .input(usermessage).model(ChatModel.GPT_4O)
                .previousResponseId(previousid)
                .build();
        AtomicReference<String> responseid = new AtomicReference<>("");
        AtomicReference<String> messageid = new AtomicReference<>("");
        List<ResponseOutputText> outputs = new ArrayList<>();

        openAIClientAsync.responses().create(responseCreateParams)
                .thenAccept(response -> {
                    responseid.set(response.previousResponseId().orElseGet(() -> ""));
                    messageid.set(response.id());
                    response.output().stream()
                            .flatMap(responseOutputItem -> responseOutputItem.message().stream())
                            .flatMap(responseOutputMessage -> responseOutputMessage.content().stream())
                            .flatMap(content -> content.outputText().stream()).forEach(
                                    outputs::add
                            );
                }).join();

        String airesponse = outputs.stream().map(ResponseOutputText::text).collect(Collectors.joining());
//        logger.debug("send async system prompt response : {} ", airesponse);
        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                application,
                (session, key) -> sessionId.equals(session) && key instanceof PageIdKey,
                new OpenAIResponseIDPushMessage(airesponse, messageid.get(), responseid.get(), AIConstants.WEBSOCKET_MESSAGE_TYPE.USERPROMPT)
        );

    }

    /**
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync
     * @param file
     * @param audioModel
     * @param previousid
     */
    public void doSendAsyncUserPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, File file, AudioModel audioModel, String previousid) {
        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();
        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        Optional<String> audiomessagetext = doAudioTranscriptions(openAIClientAsync, file, audioModel);

        audiomessagetext.ifPresentOrElse(
                message -> webSocketPushBroadcaster.broadcastAllMatchingFilter(
                        application,
                        (session, key) -> sessionId.equals(session) && key instanceof PageIdKey,
                        new OpenAIResponsePushMessage(message)
                ), () ->
                        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                                application,
                                (session, key) -> sessionId.equals(session) && key instanceof PageIdKey,
                                new OpenAIResponsePushMessage(AIConstants.CANNOT_IDENTIFY_VOICE_MESSAGE)
                        )
        );
    }

    /**
     * 指定單人GPT時的傳入System default prompt
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync
     * @param systemPrompt
     * @param vectorid
     * @param groupid
     */
    public void doSetSingleSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, String systemPrompt, String vectorid, Optional<Integer> groupid) {
        doSetSystemPrompt(application, sessionId, openAIClientAsync, Collections.singletonList(systemPrompt), Optional.of(vectorid), groupid);
    }

    /**
     * 指定單人GPT時的傳入System default prompt(List)
     */
    public void doSetSingleSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, List<String> systemPrompts, Optional<String> vectorids, Optional<Integer> groupid) {
        doSetSystemPrompt(application, sessionId, openAIClientAsync, systemPrompts, vectorids, groupid);
    }

    /**
     * 指定群組聊天System Prompt
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync
     * @param systemPrompts
     * @param groupid
     */
    public void doSetGroupSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, List<String> systemPrompts, Optional<Integer> groupid) {
        doSetSystemPrompt(application, sessionId, openAIClientAsync, systemPrompts, Optional.empty(), groupid);
    }

    /**
     * 指定群組聊天System Prompt
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync
     * @param systemPrompts
     * @param vectorids
     * @param groupid
     */
    public void doSetGroupSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, List<String> systemPrompts, Optional<String> vectorids, Optional<Integer> groupid) {
        doSetSystemPrompt(application, sessionId, openAIClientAsync, systemPrompts, vectorids, groupid);
    }

    /**
     * 指定OpenAI Vector資源進行群組聯天
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync
     * @param systemPrompt
     * @param vectorid
     * @param groupid
     */
    public void doSetGroupSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, String systemPrompt, String vectorid, Optional<Integer> groupid) {
        doSetSystemPrompt(application, sessionId, openAIClientAsync,
                Collections.singletonList(systemPrompt), Optional.of(vectorid), groupid);
    }

    /**
     * 初始化設定System Prompt後取得message_id以延續對話
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync
     * @param systemPrompts
     * @param vectorid
     * @param groupid
     */
    public void doSetSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, List<String> systemPrompts, Optional<String> vectorid, Optional<Integer> groupid) {
        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();
        List<ResponseInputItem> inputs = new ArrayList<>();

        ResponseInputItem.Message.Builder builder = ResponseInputItem.Message.builder();
        systemPrompts.forEach(builder::addInputTextContent);
        inputs.add(ResponseInputItem.ofMessage(builder.role(ResponseInputItem.Message.Role.SYSTEM)
                .build()));

        ResponseCreateParams responseCreateParams =
                vectorid.map(s -> ResponseCreateParams.builder()
                        .input(ResponseCreateParams.Input.ofResponse(inputs)).model(ChatModel.GPT_4O)
                        .addFileSearchTool(List.of(s))
                        .build()).orElseGet(() -> ResponseCreateParams.builder()
                        .input(ResponseCreateParams.Input.ofResponse(inputs)).model(ChatModel.GPT_4O)
                        .build());


        AtomicReference<String> responseid = new AtomicReference<>("");
        AtomicReference<String> messageid = new AtomicReference<>("");
        List<ResponseOutputText> outputs = new ArrayList<>();

        openAIClientAsync.responses().create(responseCreateParams)
                .thenAccept(response -> {
                    responseid.set(response.previousResponseId().orElseGet(() -> ""));
                    messageid.set(response.id());
                    response.output().stream()
                            .flatMap(responseOutputItem -> responseOutputItem.message().stream())
                            .flatMap(responseOutputMessage -> responseOutputMessage.content().stream())
                            .flatMap(content -> content.outputText().stream()).forEach(
                                    outputs::add
                            );
                }).join();

        String airesponse = outputs.stream().map(ResponseOutputText::text).collect(Collectors.joining());
//        logger.debug("set system prompt response : {} ", airesponse);
        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
//        logger.debug("send async system prompt response id : {} ", responseid.get());
//        logger.debug("applicaion name : {} ", application.getName());
//        logger.debug("sessionid : {} ", sessionId);
        IWebSocketConnectionRegistry.IConnectionsFilter filter = (session, key) -> {
//            AtomicBoolean result = new AtomicBoolean(false);
//            groupid.ifPresentOrElse(group ->
//                            result.set(key instanceof PageIdKey && key.equals(SameClassMemberIndex.groupOf(group)))
//                    , () ->
//                            result.set(sessionId.equals(session) && key instanceof PageIdKey)
//            );
//            return result.get();
            return true;
        };


        Collection<IWebSocketConnection> connections
                = iWebSocketConnectionRegistry.getConnections(application, filter);

        connections.forEach(connection -> {
//            logger.debug("System Connection : {} , Context : {} ", connection.getSessionId(), connection.getKey().getContext());
        });

        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                application,
                filter,
                new OpenAIResponseIDPushMessage(airesponse, messageid.get(), responseid.get(), AIConstants.WEBSOCKET_MESSAGE_TYPE.SYSTEMPROMPT)
        );
    }

    /**
     * 傳送訊息至同群組已連線的WebSocket Clients
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync
     * @param usermessage
     * @param previousid
     * @param groupid           groupid必須轉成文字才能以PageIdKey的Context進行比對
     */
    public void doSendGroupAsyncUserPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, String usermessage, String previousid, Optional<Integer> groupid) {

        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();
        List<ResponseInputItem> inputs = new ArrayList<>();

        inputs.add(ResponseInputItem.ofMessage(ResponseInputItem.Message.builder()
                .addInputTextContent(usermessage)
                .role(ResponseInputItem.Message.Role.USER)
                .build()));
//        logger.debug("Previous ID : {}", previousid);
        ResponseCreateParams responseCreateParams = ResponseCreateParams.builder()
                .input(usermessage).model(ChatModel.GPT_4O)
                .previousResponseId(previousid)
                .build();
        AtomicReference<String> responseid = new AtomicReference<>("");
        AtomicReference<String> messageid = new AtomicReference<>("");
        List<ResponseOutputText> outputs = new ArrayList<>();

        openAIClientAsync.responses().create(responseCreateParams)
                .thenAccept(response -> {
                    responseid.set(response.previousResponseId().orElseGet(() -> ""));
                    messageid.set(response.id());
                    response.output().stream()
                            .flatMap(responseOutputItem -> responseOutputItem.message().stream())
                            .flatMap(responseOutputMessage -> responseOutputMessage.content().stream())
                            .flatMap(content -> content.outputText().stream()).forEach(
                                    outputs::add
                            );
                }).join();


        String airesponse = outputs.stream().map(ResponseOutputText::text).collect(Collectors.joining());
//        logger.debug("send async system prompt response : {} ", airesponse);
        IWebSocketConnectionRegistry.IConnectionsFilter filter = (session, key) -> {
//            AtomicBoolean result = new AtomicBoolean(false);
//            groupid.ifPresentOrElse(group -> {
//                result.set(key instanceof PageIdKey && key.equals(SameClassMemberIndex.groupOf(group)));
//            }, () -> {
//                result.set(sessionId.equals(session) && key instanceof PageIdKey);
//            });
//            return result.get();
            return true;
        };


        Collection<IWebSocketConnection> connections
                = iWebSocketConnectionRegistry.getConnections(application, filter);

        connections.forEach(connection -> {
//            logger.debug("User Connection : {} , Context : {} ", connection.getSessionId(), connection.getKey().getContext());
        });

        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                application,
                filter,
                new OpenAIResponseIDPushMessage(airesponse, messageid.get(), responseid.get(), AIConstants.WEBSOCKET_MESSAGE_TYPE.USERPROMPT)
        );

    }

    /**
     * 推送使用者聊天訊息，用來更新群聊前端頁面
     *
     * @param application
     * @param sessionId
     * @param message
     * @param groupid
     */
    public void doUpdateGroupUserChatPanel(Application application, String sessionId, String message, Optional<Integer> groupid) {
        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();
        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        IWebSocketConnectionRegistry.IConnectionsFilter filter = (session, key) -> {
//            AtomicBoolean result = new AtomicBoolean(false);
//            groupid.ifPresentOrElse(group -> {
//                result.set(key instanceof PageIdKey && key.equals(SameClassMemberIndex.groupOf(group)) && (!sessionId.equals(session)));
//            }, () -> {
//                result.set(sessionId.equals(session) && key instanceof PageIdKey);
//            });
//            return result.get();
            return true;
        };
        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                application,
                filter,
                new UserPushMessage(message)
        );

    }


    /**
     * 將使用者的語音送給OpenAI轉文字後，再送出至前端，之後更新至群組對話
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync
     * @param file
     * @param audioModel
     * @param previousid
     * @param groupid
     */
    public void doSendGroupAsyncUserAudioPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, File file, AudioModel audioModel, String previousid, Optional<Integer> groupid) {
        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();

        Optional<String> audiomessagetext = doAudioTranscriptions(openAIClientAsync, file, audioModel);


        IWebSocketConnectionRegistry.IConnectionsFilter filter = (session, key) -> {
//            AtomicBoolean result = new AtomicBoolean(false);
//            groupid.ifPresentOrElse(group -> {
//                result.set(key instanceof PageIdKey && key.equals(SameClassMemberIndex.groupOf(group)));
//            }, () -> {
//                result.set(sessionId.equals(session) && key instanceof PageIdKey);
//            });
//            return result.get();
            return true;
        };


        Collection<IWebSocketConnection> connections
                = iWebSocketConnectionRegistry.getConnections(application, filter);

        connections.forEach(connection -> {
//            logger.debug("User Connection : {} , Context : {} ", connection.getSessionId(), connection.getKey().getContext());
        });

        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        audiomessagetext.ifPresentOrElse(
                message ->
                        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                                application,
                                filter,
                                new OpenAIResponsePushMessage(message)
                        ),
                () ->
                        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                                application,
                                filter,
                                new OpenAIResponsePushMessage(AIConstants.CANNOT_IDENTIFY_VOICE_MESSAGE)
                        )
        );

    }

    /**
     * OpenAI語音轉文字
     *
     * @param openAIClientAsync
     * @param file              音檔路徑
     * @param audioModel        OpenAI Audio Model
     * @return
     * @throws ExecutionException
     * @throws InterruptedException
     */
    public Optional<String> doAudioTranscriptions(OpenAIClientAsync openAIClientAsync, File file, AudioModel audioModel) {

        AtomicReference<String> message = new AtomicReference<>("");

        if (!file.exists() || !file.isFile() || file.length() == 0) {
            logger.debug("file not found or empty: {}", file.getAbsolutePath());
        } else {

            TranscriptionCreateParams createParams = TranscriptionCreateParams.builder()
                    .file(file.toPath())
                    .model(audioModel)
                    .build();

            openAIClientAsync.audio().transcriptions().create(createParams)
                    .thenAccept(
                            transcriptionCreateResponse ->
                                    message.set(transcriptionCreateResponse.asTranscription().text())
                    ).join();
        }

//        logger.debug("audio transcriptions : {}", message.get());

        return Optional.ofNullable(message.get());
    }
}