package tw.com.slsinfo.essayai.services;

import com.beust.jcommander.Strings;
import com.openai.client.OpenAIClientAsync;
import com.openai.models.ChatModel;
import com.openai.models.responses.ResponseCreateParams;
import com.openai.models.responses.ResponseInputItem;
import com.openai.models.responses.ResponseOutputText;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.spi.CDI;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.Application;
import org.apache.wicket.protocol.ws.WebSocketSettings;
import org.apache.wicket.protocol.ws.api.IWebSocketConnection;
import org.apache.wicket.protocol.ws.api.WebSocketPushBroadcaster;
import org.apache.wicket.protocol.ws.api.registry.IWebSocketConnectionRegistry;
import org.apache.wicket.protocol.ws.api.registry.PageIdKey;
import tw.com.slsinfo.commons.io.DTUtils;
import tw.com.slsinfo.essayai.chatroom.WebSocketAIPayload;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;
import tw.com.slsinfo.essayai.models.GenreType;
import tw.com.slsinfo.essayai.models.openai.*;
import tw.com.slsinfo.essayai.openai.LLM4WritingTokenLoaderSingleton;
import tw.com.slsinfo.essayai.utils.AIConstants;
import tw.com.slsinfo.essayai.utils.AIMarker;
import tw.com.slsinfo.essayai.utils.AISystemPrompts;

import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;


/**
 * 使用者送出prompt後，會以背景執行緒呼叫API，並等待AI思考，取得回應後再以WebSocket方式送回前端並由Wicket Page進行頁面更新
 */
@ApplicationScoped
public class OpenAIWritingChatUpdaterService {

    private final Logger logger = LogManager.getLogger(OpenAIWritingChatUpdaterService.class);
    private String apiKey;
    private String systemPrompt;
    private WebSocketPushBroadcaster webSocketPushBroadcaster;

    @PostConstruct
    void init() {
        apiKey = LLM4WritingTokenLoaderSingleton.INSTANCE.getToken();
        systemPrompt = LLM4WritingTokenLoaderSingleton.INSTANCE.getToken();
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
    @Deprecated
    public void doSendAsyncUserPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, String usermessage, Optional<String> previousid) {

        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();
        List<ResponseInputItem> inputs = new ArrayList<>();

        inputs.add(ResponseInputItem.ofMessage(ResponseInputItem.Message.builder()
                .addInputTextContent(usermessage)
                .role(ResponseInputItem.Message.Role.USER)
                .build()));
        logger.debug("Previous ID : {}", previousid);
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
        logger.debug("send async system prompt response : {} ", airesponse);
        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                application,
                (session, key) -> sessionId.equals(session) && key instanceof PageIdKey,
                new OpenAIResponseIDPushMessage(airesponse, messageid.get(), responseid.get(), AIConstants.WEBSOCKET_MESSAGE_TYPE.USERPROMPT)
        );

    }


    /**
     * 指定單人GPT時的System default prompt
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync
     * @param groupid
     */
    @Deprecated
    public void doSetSingleSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, Optional<Integer> groupid) {
        doSetSystemPrompt(application, sessionId, openAIClientAsync, Collections.singletonList("你是一位作文指導老師，目前擔任中文寫作小組討論主持人。你必須使用溫和、理性、鼓勵、親和的語氣進行回答，避免過度諂媚。用字能讓12歲的青少年理解。\n" +
                        "在討論過程中，不得直接代寫段落、文章或提供完整標準答案。而且只使用具啟發性的引導式提問，並且引導學生思考與表達，而且善用鼓勵觀察、提出個人觀點、釐清立場、補充說明，以讓學生培養正向價值觀。\n" +
                        "請全程使用繁體中文與台灣用語。若學生使用中國用語，請轉換成台灣用法，例如：視頻 → 影片、反饋 → 回饋、質量 → 品質、屏幕 → 螢幕，等等。並請先向學生自我介紹後，即可開始進行作文寫作引導。然後請使用Markdown格式回覆。"),
                Optional.empty(), groupid, Optional.empty());
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
     * @param previousId
     */
    public void doSetSingleSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, String systemPrompt, String vectorid, Optional<Integer> groupid, Optional<String> previousId) {
        doSetSystemPrompt(application, sessionId, openAIClientAsync, Collections.singletonList(systemPrompt), Optional.of(vectorid), groupid, previousId);
    }

    /**
     * 指定單人GPT時的傳入System default prompt(List)
     */
    public void doSetSingleSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, List<String> systemPrompts, Optional<String> vectorids, Optional<Integer> groupid, Optional<String> previousId) {
        doSetSystemPrompt(application, sessionId, openAIClientAsync, systemPrompts, vectorids, groupid, previousId);
    }


    /**
     * 指定群組聊天System Prompt
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync
     * @param groupid
     */
    public void doSetGroupSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, Optional<Integer> groupid) {
        doSetSystemPrompt(application, sessionId, openAIClientAsync,
                Collections.singletonList("你是一位負責小組討論的資深教師，會提醒每個不同學生應注意事項。每位學生說話前，會用「我是某某某」說，例如「我是小明」說開始，代表的是「小明」這位同學在說話。請仔細分辨不同學生說的話。" +
                        "你必須使用溫和、理性、鼓勵、親和的語氣進行回答，避免過度諂媚。用字能讓12歲的青少年理解。\n" +
                        "在討論過程中，不得直接提供完整標準答案。而且只使用具啟發性的引導式提問，並且引導學生思考與表達，而且善用鼓勵觀察、提出個人觀點、釐清立場、補充說明，以讓學生培養正向價值觀。\n" +
                        "請全程使用繁體中文與台灣用語。若學生使用中國用語，請轉換成台灣用法，例如：視頻 → 影片、反饋 → 回饋、質量 → 品質、屏幕 → 螢幕，等等。並請先向學生自我介紹後，即可開始進行作文寫作引導。然後請使用Markdown格式回覆。 "),
                Optional.empty(), groupid, Optional.empty());
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
        doSetSystemPrompt(application, sessionId, openAIClientAsync, systemPrompts, Optional.empty(), groupid, Optional.empty());
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
     * @param previousId
     */
    public void doSetGroupSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, List<String> systemPrompts, Optional<String> vectorids, Optional<Integer> groupid, Optional<String> previousId) {
        doSetSystemPrompt(application, sessionId, openAIClientAsync, systemPrompts, vectorids, groupid, previousId);
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
    public void doSetGroupSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, String systemPrompt, String vectorid, Optional<Integer> groupid, Optional<String> previousId) {
        doSetSystemPrompt(application, sessionId, openAIClientAsync,
                Collections.singletonList(systemPrompt), Optional.of(vectorid), groupid, previousId);
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
     * @param previousId        先前的對話ID
     */
    @Deprecated
    public void doSetSystemPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, List<String> systemPrompts, Optional<String> vectorid, Optional<Integer> groupid, Optional<String> previousId) {
        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();
        List<ResponseInputItem> inputs = new ArrayList<>();

        ResponseInputItem.Message.Builder builder = ResponseInputItem.Message.builder();
        systemPrompts.forEach(builder::addInputTextContent);
        inputs.add(ResponseInputItem.ofMessage(builder.role(ResponseInputItem.Message.Role.SYSTEM)
                .build()));
        previousId.ifPresentOrElse(id -> logger.debug("system prompt previous id : {}", id), () ->
                logger.debug("system prompt previous id not available")
        );
        ResponseCreateParams responseCreateParams = ResponseCreateParams.builder()
                .input(ResponseCreateParams.Input.ofResponse(inputs)).model(ChatModel.GPT_4O)
                .previousResponseId(previousId)
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
        logger.debug("set system prompt response : {} ", airesponse);
        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        logger.debug("send async system prompt response id : {} ", responseid.get());
        logger.debug("send async system prompt message id : {} ", messageid.get());
        logger.debug("applicaion name : {} ", application.getName());
        logger.debug("sessionid : {} ", sessionId);
        IWebSocketConnectionRegistry.IConnectionsFilter filter = (session, key) -> {
//            AtomicBoolean result = new AtomicBoolean(false);
//            groupid.ifPresentOrElse(group ->
//                            result.set(key instanceof PageIdKey && key.equals(SameClassMemberIndex(group)))
//                    , () ->
//                            result.set(sessionId.equals(session) && key instanceof PageIdKey)
//            );
//            return result.get();
            return true;
        };
        logger.debug("filter : {} ", filter);
        Collection<IWebSocketConnection> connections
                = iWebSocketConnectionRegistry.getConnections(application, filter);

        logger.debug("connections : {} ", connections);
//        if (logger.isDebugEnabled()) {
        connections.forEach(connection ->
                logger.debug("System Connection : {} , Context : {} ", connection.getSessionId(), connection.getKey().getContext())
        );
//        }

        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                application,
                filter,
                new OpenAIResponseIDPushMessage(airesponse, messageid.get(), responseid.get(), AIConstants.WEBSOCKET_MESSAGE_TYPE.RESPONSEID)
        );
    }

    /**
     * 建立結構樹
     *
     * @param application
     * @param sessionId
     * @param openAIClientAsync
     * @param previousid
     * @param genreType
     * @param vectorid
     * @param groupid
     */
    @Deprecated
    public void doSendGroupAsyncUserTreePrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, Optional<String> previousid, Optional<GenreType> genreType, Optional<String> vectorid, Optional<Integer> groupid) {
        logger.debug("doSendGroupAsyncUserTreePrompt : 建立結構樹Prompt");
        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();
        List<ResponseInputItem> inputs = new ArrayList<>();
        String usermessage = "";
        if (genreType.isPresent() && vectorid.isPresent()) {
            switch (genreType.get()) {
                case EXPOSITORY -> usermessage = "請依照「Expository_prompt.docx」內容，把討論內容整理成樹狀JSON。";
                case LYRICAL -> usermessage = "請依照「Lyrical_prompt.docx」內容，把討論內容整理成樹狀JSON。";
                case NARRATIVE -> usermessage = "請依照「Narrative_prompt.docx」內容，把討論內容整理成樹狀JSON。";
                case ARGUMENTATIVE -> usermessage = "請依照「Argumentative_prompt.docx」內容，把討論內容整理成樹狀JSON。";
            }
        }
        inputs.add(ResponseInputItem.ofMessage(ResponseInputItem.Message.builder()
                .addInputTextContent(usermessage)
                .role(ResponseInputItem.Message.Role.USER)
                .build()));
        logger.debug("-----------Previous ID : {}", previousid);
        logger.debug("-------------genreType:{}", genreType);
        logger.debug("-----------VectorID : {}", vectorid.stream().collect(Collectors.joining(";")));

        logger.debug("-------------inputs:{}", inputs);
        ResponseCreateParams responseCreateParams = ResponseCreateParams.builder()
                .input(ResponseCreateParams.Input.ofResponse(inputs)).model(ChatModel.GPT_5_MINI)
                .build();

        logger.debug("-------------responseCreateParams:{}", responseCreateParams);
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
        logger.debug("---------------outputs:{}", outputs);
        String airesponse = outputs.stream().map(ResponseOutputText::text).collect(Collectors.joining());
        logger.debug("---------------send async system prompt response : {} ", airesponse);
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

        if (logger.isDebugEnabled()) {
            connections.forEach(connection ->
                    logger.debug("User Connection : {} , Context : {} ", connection.getSessionId(), connection.getKey().getContext())
            );
        }

        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                application,
                filter,
                new OpenAITreeResponsePushMessage(airesponse, messageid.get(), responseid.get())
        );
    }


    /**
     * 傳送訊息至同群組已連線的WebSocket Clients
     *
     * @param webSocketAIPayload Wicket WebSocket資訊及使用者群組資訊Payload
     * @param usermessage
     */
    @Deprecated
    public void doSendGroupAsyncUserPrompt(WebSocketAIPayload webSocketAIPayload, String usermessage) {
        doSendGroupAsyncUserPrompt(webSocketAIPayload.application(), webSocketAIPayload.sessionId(), webSocketAIPayload.openAIClientAsync(), usermessage, webSocketAIPayload.previousid(), webSocketAIPayload.groupid());
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
    @Deprecated
    public void doSendGroupAsyncUserPrompt(Application application, String sessionId, OpenAIClientAsync openAIClientAsync, String usermessage, Optional<String> previousid, Optional<Integer> groupid) {

        IWebSocketConnectionRegistry iWebSocketConnectionRegistry = WebSocketSettings.Holder.get(application).getConnectionRegistry();
        List<ResponseInputItem> inputs = new ArrayList<>();

        inputs.add(ResponseInputItem.ofMessage(ResponseInputItem.Message.builder()
                .addInputTextContent(usermessage)
                .role(ResponseInputItem.Message.Role.USER)
                .build()));
        logger.debug("Previous ID : {}", previousid);
        ResponseCreateParams responseCreateParams = ResponseCreateParams.builder()
                .input(usermessage).model(ChatModel.GPT_4O)
                .previousResponseId(previousid)
                .build();
        List<ResponseOutputText> outputs = new ArrayList<>();

        AtomicReference<String> responseid = new AtomicReference<>("");
        AtomicReference<String> messageid = new AtomicReference<>("");
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
        logger.debug("send async system prompt response : {} ", airesponse);
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
            logger.debug("User Connection : {} , Context : {} ", connection.getSessionId(), connection.getKey().getContext());
        });

        webSocketPushBroadcaster = new WebSocketPushBroadcaster(iWebSocketConnectionRegistry);
        webSocketPushBroadcaster.broadcastAllMatchingFilter(
                application,
                filter,
                new OpenAIResponseIDPushMessage(airesponse, messageid.get(), responseid.get(), AIConstants.WEBSOCKET_MESSAGE_TYPE.USERPROMPT)
        );
    }


    /**
     * 小組對話第一階段，初始化對話ID之用
     *
     * @param openAIClientAsync
     * @param systemPrompts
     * @param vectorid          Uploaded file database vector
     * @param chatModel         OpenAI Chat Model
     * @return
     */
    public String doSetGroupAsyncSystemPrompt(OpenAIClientAsync openAIClientAsync, List<String> systemPrompts, Optional<String> vectorid, ChatModel chatModel) {
        logger.debug("小組對話產生第一次對話ID");
        List<ResponseInputItem> inputs = new ArrayList<>();

        ResponseInputItem.Message.Builder builder = ResponseInputItem.Message.builder();
        systemPrompts.forEach(builder::addInputTextContent);
        inputs.add(ResponseInputItem.ofMessage(builder.role(ResponseInputItem.Message.Role.SYSTEM)
                .build()));
        ResponseCreateParams responseCreateParams = ResponseCreateParams.builder()
                .input(ResponseCreateParams.Input.ofResponse(inputs)).model(chatModel)
                .build();

        AtomicReference<String> messageid = new AtomicReference<>("");
        List<ResponseOutputText> outputs = new ArrayList<>();

        openAIClientAsync.responses().create(responseCreateParams)
                .thenAccept(response -> {
                    messageid.set(response.id());
                    response.output().stream()
                            .flatMap(responseOutputItem -> responseOutputItem.message().stream())
                            .flatMap(responseOutputMessage -> responseOutputMessage.content().stream())
                            .flatMap(content -> content.outputText().stream()).forEach(
                                    outputs::add
                            );
                }).join();
        logger.debug("第一之對話ID產生結果 : {} ", messageid.get());
        return messageid.get();
    }


    /**
     * 小組對話AI回覆，預設使用GPT_4O模型
     *
     * @param openAIClientAsync OpenAI AsyncClient
     * @param systemPrompts     System Prompts
     * @param userPrompts       User Prompts
     * @param vectorid          OpenAI Vector Database ID
     * @return
     */
    public OpenAIResponseIDPushMessage doSendGroupAIAsyncPrompt(OpenAIClientAsync openAIClientAsync, Optional<String> previousid, List<String> systemPrompts, List<String> userPrompts, Optional<String> vectorid, ChatPageModel chatPageModel) {
        return doSendGroupAIAsyncPrompt(openAIClientAsync, previousid, systemPrompts, userPrompts, vectorid, ChatModel.GPT_4O, chatPageModel);
    }

    /**
     * 小組對話AI回覆
     *
     * @param openAIClientAsync OpenAI AsyncClient
     * @param systemPrompts     System Prompts
     * @param userPrompts       User Prompts
     * @param vectorid          OpenAI Vector Database ID
     * @param chatModel         OpenAI Chat Model
     * @return
     */
    public OpenAIResponseIDPushMessage doSendGroupAIAsyncPrompt(OpenAIClientAsync openAIClientAsync, Optional<String> previousid, List<String> systemPrompts, List<String> userPrompts, Optional<String> vectorid, ChatModel chatModel, ChatPageModel chatPageModel) {

        List<ResponseInputItem> inputs = new ArrayList<>();
        List<String> prompts = new ArrayList<>();
        ResponseInputItem.Message.Builder systemBuilder = ResponseInputItem.Message.builder();
        //2026-01-10 加入強制覆寫先前System Prompt
        //prompts.add(AIConstants.OVERRIDE_PROMPT);
        if (!systemPrompts.isEmpty()) {
            systemPrompts.forEach(systemBuilder::addInputTextContent);
            prompts.addAll(systemPrompts);
            inputs.add(ResponseInputItem.ofMessage(systemBuilder.role(ResponseInputItem.Message.Role.SYSTEM)
                    .build()));
        }

        if (!userPrompts.isEmpty()) {
            ResponseInputItem.Message.Builder userBuilder = ResponseInputItem.Message.builder();
            userPrompts.forEach(userBuilder::addInputTextContent);
            prompts.addAll(userPrompts);
            inputs.add(ResponseInputItem.ofMessage(userBuilder.role(ResponseInputItem.Message.Role.USER)
                    .build()));
        }

        logger.debug("OpenAIResponseIDPushMessage doSendGroupAIAsyncPrompt previousid : {}", previousid.get());
        //移除vectorid的影響
        ResponseCreateParams responseCreateParams =
                ResponseCreateParams.builder()
                        .input(ResponseCreateParams.Input.ofResponse(inputs)).model(chatModel)
                        .build();

        List<ResponseOutputText> outputs = new ArrayList<>();

        AtomicReference<String> responseid = new AtomicReference<>("");
        AtomicReference<String> messageid = new AtomicReference<>("");
        logger.debug(AIMarker.READY_TO_SEND_PROMPT, "{} - {}", previousid, DTUtils.getISODateTime());
        saveChatLogs(chatPageModel, prompts, EventType.READY_TO_SEND_PROMPT);
        openAIClientAsync.responses().create(responseCreateParams)
                .thenAccept(response -> {
                    //送給OpenAI的previousId或是它回傳的previousId
                    responseid.set(response.previousResponseId().orElseGet(previousid::get));
                    //OpenAI回傳此次對話ID
                    messageid.set(response.id());
                    response.output().stream()
                            .flatMap(responseOutputItem -> responseOutputItem.message().stream())
                            .flatMap(responseOutputMessage -> responseOutputMessage.content().stream())
                            .flatMap(content -> content.outputText().stream()).forEach(
                                    outputs::add
                            );
                }).join();

        logger.debug("Chat UpdateService Old ResponseID(PreviousId) : {} ", responseid.get());
        logger.debug("Chat UpdateService Old New MessageID : {} ", messageid.get());
        String airesponse = outputs.stream().map(ResponseOutputText::text).collect(Collectors.joining());
        logger.debug(AIMarker.GOT_AI_RESPONSE, "{} - {}", previousid, DTUtils.getISODateTime());
        saveChatLogs(chatPageModel, Collections.singletonList(airesponse), EventType.GOT_AI_RESPONSE);
        return new OpenAIResponseIDPushMessage(airesponse, messageid.get(), responseid.get(), AIConstants.WEBSOCKET_MESSAGE_TYPE.USERPROMPT);
    }


    /**
     * 取得Tree Model Json
     *
     * @param openAIClientAsync
     * @param previousid
     * @param genreType
     * @param vectorid
     * @return
     */
    public OpenAITreeResponsePushMessage doSendGroupAsyncUserTreePrompt(OpenAIClientAsync openAIClientAsync, Optional<String> previousid, Optional<GenreType> genreType, Optional<String> vectorid, ChatPageModel chatPageModel) {
        logger.debug("doSendGroupAsyncUserTreePrompt : 建立結構樹Prompt");
        List<ResponseInputItem> inputs = new ArrayList<>();
        String usermessage = "";
        if (genreType.isPresent() && vectorid.isPresent()) {
            switch (genreType.get()) {
                case EXPOSITORY ->
                        usermessage = "你是一位結構化資訊抽取與樹狀知識整理助理。請依據我們的對話內容，將內容整理成**樹狀 JSON 陣列**，以便用於樹圖元件顯示。\n" +
                                "\n" +
                                "## 產出要求\n" +
                                "1) **只回傳 JSON 陣列**，不要任何額外說明或前後置文字。  \n" +
                                "2) **不包含換行符號**（整段為單行 JSON）。  \n" +
                                "3) **字元編碼**以 UTF-8 為準；如文本含引號請正確跳脫。  \n" +
                                "4) **每個節點物件**都必須包含：`key`, `parent`, `text`, `fixed` 四個欄位。  \n" +
                                "\n" +
                                "## 結構與鍵值（嚴格遵守）\n" +
                                "- 根節點（唯一，`fixed=false`）  \n" +
                                "  { \"key\": \"root\", \"text\": \"說明文\", \"fixed\": true }\n" +
                                "\n" +
                                "- 第二層（皆為 root 的子節點，`fixed= true `）  \n" +
                                "  { \"key\": \"intro\", \"parent\": \"root\", \"text\": \"總說\", \"fixed\": true }  \n" +
                                "  { \"key\": \"detail\", \"parent\": \"root\", \"text\": \"分說\", \"fixed\": true }  \n" +
                                "  { \"key\": \"conclude\", \"parent\": \"root\", \"text\": \"總說\", \"fixed\": true }  \n" +
                                "\n" +
                                "- 第三層（摘要節點，皆 `fixed=false`）  \n" +
                                "  - intro 底下：說明具體事物的特點、說明抽象事理的概念  \n" +
                                "  - detail 底下：分項說明一、分項說明二、分項說明三  \n" +
                                "  - conclude 底下：總結特點  \n" +
                                "\n" +
                                "## 節點格式範本\n" +
                                "{\n" +
                                "  \"key\": \"<固定代號或自定唯一鍵>\",\n" +
                                "  \"parent\": \"<父層 key>\",\n" +
                                "  \"text\": \"<條列且精煉的內容摘要，必要時用；分隔子點，每個摘要須15字元以內>\",\n" +
                                "  \"fixed\": false\n" +
                                "}\n" +
                                "\n" +
                                "## 摘要與取捨原則\n" +
                                "- 總說（intro）：先概述具體事物的特徵，再解釋抽象概念。  \n" +
                                "- 分說（detail）：以條列方式呈現重點，分別整理「分項說明一、二、三」。  \n" +
                                "- 總說（conclude）：收尾時總結說明對象的特點或意涵。  \n" +
                                "- **每個 `text` 字串長度須控制在 15 字元以內，避免過長敘述。**  \n" +
                                "- 原文若有缺漏或完全無法判定，則不產出節點。 \n" +
                                "\n" +
                                "## 驗收清單\n" +
                                "- ✅ 只輸出單一 JSON 陣列。  \n" +
                                "- ✅ root 與三大綱要（intro/detail/conclude）均存在且 `fixed= true `。  \n" +
                                "- ✅ 各綱要底下皆有指定的第三層摘要節點，且 `fixed=false`。  \n" +
                                "- ✅ 各 `text` 長度必須在 15 字元以內。  \n" +
                                "- ✅ 可直接載入樹圖元件，互動邏輯正確。  \n" +
                                "\n" +
                                "## 最終輸出示意\n" +
                                "[\n" +
                                "  { \"key\":\"root\",\"text\":\"說明文\",\"fixed\": true },\n" +
                                "  { \"key\":\"intro\",\"parent\":\"root\",\"text\":\"總說\",\"fixed\": true },\n" +
                                "  { \"key\":\"detail\",\"parent\":\"root\",\"text\":\"分說\",\"fixed\": true },\n" +
                                "  { \"key\":\"conclude\",\"parent\":\"root\",\"text\":\"總說\",\"fixed\": true },\n" +
                                "  { \"key\":\"intro_feature\",\"parent\":\"intro\",\"text\":\"具體特點\",\"fixed\":false },\n" +
                                "  { \"key\":\"intro_concept\",\"parent\":\"intro\",\"text\":\"抽象概念\",\"fixed\": false },\n" +
                                "  { \"key\":\"detail_1\",\"parent\":\"detail\",\"text\":\"分項一\",\"fixed\": false },\n" +
                                "  { \"key\":\"detail_2\",\"parent\":\"detail\",\"text\":\"分項二\",\"fixed\": false },\n" +
                                "  { \"key\":\"detail_3\",\"parent\":\"detail\",\"text\":\"分項三\",\"fixed\": false },\n" +
                                "  { \"key\":\"conclude_summary\",\"parent\":\"conclude\",\"text\":\"特點總結\",\"fixed\": false }\n" +
                                "]\n";
                case LYRICAL ->
                        usermessage = "你是一位結構化資訊抽取與樹狀知識整理助理。請依據我們的對話內容，將內容整理成**樹狀 JSON 陣列**，以便用於樹圖元件顯示。\n" +
                                "\n" +
                                "## 產出要求\n" +
                                "1) **只回傳 JSON 陣列**，不要任何額外說明或前後置文字。  \n" +
                                "2) **不包含換行符號**（整段為單行 JSON）。  \n" +
                                "3) **字元編碼**以 UTF-8 為準；如文本含引號請正確跳脫。  \n" +
                                "4) **每個節點物件**都必須包含：`key`, `parent`, `text`, `fixed` 四個欄位。\n" +
                                "\n" +
                                "## 結構與鍵值（嚴格遵守）\n" +
                                "- 根節點（唯一）  \n" +
                                "  { \"key\": \"root\", \"text\": \"作文標題或題目\", \"fixed\": true}\n" +
                                "\n" +
                                "- 五大綱要（皆為 root 的子節點，`fixed` 一律為 ` true `）  \n" +
                                "  { \"key\": \"dot\",    \"parent\": \"root\", \"text\": \"點題\", \"fixed\": true }  \n" +
                                "  { \"key\": \"bg\",     \"parent\": \"root\", \"text\": \"背景\", \"fixed\": true }  \n" +
                                "  { \"key\": \"evt\",    \"parent\": \"root\", \"text\": \"事件\", \"fixed\": true }  \n" +
                                "  { \"key\": \"mood\", \"parent\": \"root\", \"text\": \"抒情\", \"fixed\": true }  \n" +
                                "  { \"key\": \"end\",    \"parent\": \"root\", \"text\": \"收尾\", \"fixed\": true }  \n" +
                                "\n" +
                                "- 第三層重點整理（`fixed` 一律為 `false`）  \n" +
                                "  - dot: 關鍵字、普遍看法、個人見解  \n" +
                                "  - bg: 時間、地點、人物、景色、物品  \n" +
                                "  - evt: 起因、經過、轉折  \n" +
                                "  - mood: 最後的感受或體悟  \n" +
                                "  - end: 內容總結、前後呼應、反思  \n" +
                                "\n" +
                                "## 節點格式範本\n" +
                                "{\n" +
                                "  \"key\": \"<固定代號或自定唯一鍵>\",\n" +
                                "  \"parent\": \"<父層 key>\",\n" +
                                "  \"text\": \"<條列且精煉的內容摘要，必要時用；分隔子點，每個摘要須15字元以內>\",\n" +
                                "  \"fixed\": false\n" +
                                "}\n" +
                                "\n" +
                                "## 摘要與取捨原則\n" +
                                "- 點題：以 1–2 句提煉主旨；關鍵詞可用全形分號（；）分隔。  \n" +
                                "- 背景：時間、地點、人事物與景物僅擷要，避免冗長敘述。  \n" +
                                "- 事件：清楚區分「起因 → 經過 → 轉折」。  \n" +
                                "- 結果：聚焦「情緒變化／體悟」。  \n" +
                                "- 收尾：總結主旨並與開頭呼應；提出反思。  \n" +
                                "- **每個 `text` 字串長度須控制在 15 字元以內，避免過長敘述。**  \n" +
                                "- 原文若有缺漏或完全無法判定，則不產出節點。  \n" +
                                "\n" +
                                "## 驗收清單\n" +
                                "- ✅ 只輸出**單一 JSON 陣列**；無多餘字元與換行。  \n" +
                                "- ✅ 包含 root 與五大綱要（皆 fixed= true）。  \n" +
                                "- ✅ 每個綱要下皆有指定的第三層重點節點（皆 fixed=false）。  \n" +
                                "- ✅ fixed 與 parent 設定符合樹圖邏輯，可直接載入前端元件使用。  \n" +
                                "- ✅ 各 `text` 長度必須在 15 字元以內。  \n" +
                                "\n" +
                                "## 最終輸出示意\n" +
                                "[\n" +
                                "  { \"key\":\"root\",\"text\":\"作文標題或題目\",\"fixed\": true },\n" +
                                "  { \"key\":\"dot\",\"parent\":\"root\",\"text\":\"點題\",\"fixed\": true },\n" +
                                "  { \"key\":\"bg\",\"parent\":\"root\",\"text\":\"背景\",\"fixed\": true },\n" +
                                "  { \"key\":\"evt\",\"parent\":\"root\",\"text\":\"事件\",\"fixed\": true },\n" +
                                "  { \"key\":\"mood\",\"parent\":\"root\",\"text\":\"抒情\",\"fixed\": true },\n" +
                                "  { \"key\":\"end\",\"parent\":\"root\",\"text\":\"收尾\",\"fixed\": true },\n" +
                                "  { \"key\":\"dot_kw\",\"parent\":\"dot\",\"text\":\"關鍵字；…\",\"fixed\":false },\n" +
                                "  { \"key\":\"dot_common\",\"parent\":\"dot\",\"text\":\"普遍看法；…\",\"fixed\": false },\n" +
                                "  { \"key\":\"dot_view\",\"parent\":\"dot\",\"text\":\"個人見解；…\",\"fixed\": false }\n" +
                                "  /* 其餘節點同規則補齊 */\n" +
                                "]\n";
                case NARRATIVE ->
                        usermessage = "你是一位結構化資訊抽取與樹狀知識整理助理。請依據我們的對話內容，將內容整理成**樹狀 JSON 陣列**，以便用於樹圖元件顯示。\n" +
                                "\n" +
                                "## 產出要求\n" +
                                "1) **只回傳 JSON 陣列**，不要任何額外說明或前後置文字。  \n" +
                                "2) **不包含換行符號**（整段為單行 JSON）。  \n" +
                                "3) **字元編碼**以 UTF-8 為準；如文本含引號請正確跳脫。  \n" +
                                "4) **每個節點物件**都必須包含：`key`, `parent`, `text`, `fixed` 四個欄位。\n" +
                                "\n" +
                                "## 結構與鍵值（嚴格遵守）\n" +
                                "- 根節點（唯一）  \n" +
                                "  { \"key\": \"root\", \"text\": \"作文標題或題目\", \"fixed\": true}\n" +
                                "\n" +
                                "- 五大綱要（皆為 root 的子節點，`fixed` 一律為 ` true `）  \n" +
                                "  { \"key\": \"dot\",    \"parent\": \"root\", \"text\": \"點題\", \"fixed\": true }  \n" +
                                "  { \"key\": \"bg\",     \"parent\": \"root\", \"text\": \"背景\", \"fixed\": true }  \n" +
                                "  { \"key\": \"evt\",    \"parent\": \"root\", \"text\": \"事件\", \"fixed\": true }  \n" +
                                "  { \"key\": \"result\", \"parent\": \"root\", \"text\": \"結果\", \"fixed\": true }  \n" +
                                "  { \"key\": \"end\",    \"parent\": \"root\", \"text\": \"收尾\", \"fixed\": true }  \n" +
                                "\n" +
                                "- 第三層重點整理（`fixed` 一律為 `false`）  \n" +
                                "  - dot: 關鍵字、普遍看法、個人見解  \n" +
                                "  - bg: 時間、地點、人物、景色、物品  \n" +
                                "  - evt: 起因、經過、轉折  \n" +
                                "  - result: 事件結局或體悟  \n" +
                                "  - end: 內容總結、前後呼應、反思  \n" +
                                "\n" +
                                "## 節點格式範本\n" +
                                "{\n" +
                                "  \"key\": \"<固定代號或自定唯一鍵>\",\n" +
                                "  \"parent\": \"<父層 key>\",\n" +
                                "  \"text\": \"<條列且精煉的內容摘要，必要時用；分隔子點，每個摘要須15字元以內>\",\n" +
                                "  \"fixed\": false\n" +
                                "}\n" +
                                "\n" +
                                "## 摘要與取捨原則\n" +
                                "- 點題：以 1–2 句提煉主旨；關鍵詞可用全形分號（；）分隔。  \n" +
                                "- 背景：時間、地點、人事物與景物僅擷要，避免冗長敘述。  \n" +
                                "- 事件：清楚區分「起因 → 經過 → 轉折」。  \n" +
                                "- 結果：聚焦「結果／體悟」。  \n" +
                                "- 收尾：總結主旨並與開頭呼應；提出反思。  \n" +
                                "- **每個 `text` 字串長度須控制在 15 字元以內，避免過長敘述。**  \n" +
                                "- 原文若有缺漏或完全無法判定，則不產出節點。\n" +
                                "\n" +
                                "## 驗收清單\n" +
                                "- ✅ 只輸出**單一 JSON 陣列**；無多餘字元與換行。  \n" +
                                "- ✅ 包含 root 與五大綱要（皆 fixed=true）。  \n" +
                                "- ✅ 每個綱要下皆有指定的第三層重點節點（皆 fixed= false）。  \n" +
                                "- ✅ fixed 與 parent 設定符合樹圖邏輯，可直接載入前端元件使用。  \n" +
                                "- ✅ 各 `text` 長度必須在 15 字元以內。  \n" +
                                "\n" +
                                "## 最終輸出示意\n" +
                                "[\n" +
                                "  { \"key\":\"root\",\"text\":\"作文標題或題目\",\"fixed\":true },\n" +
                                "  { \"key\":\"dot\",\"parent\":\"root\",\"text\":\"點題\",\"fixed\": true },\n" +
                                "  { \"key\":\"bg\",\"parent\":\"root\",\"text\":\"背景\",\"fixed\": true },\n" +
                                "  { \"key\":\"evt\",\"parent\":\"root\",\"text\":\"事件\",\"fixed\": true },\n" +
                                "  { \"key\":\"result\",\"parent\":\"root\",\"text\":\"結果\",\"fixed\": true },\n" +
                                "  { \"key\":\"end\",\"parent\":\"root\",\"text\":\"收尾\",\"fixed\": true },\n" +
                                "  { \"key\":\"dot_kw\",\"parent\":\"dot\",\"text\":\"關鍵字；…\",\"fixed\":false },\n" +
                                "  { \"key\":\"dot_common\",\"parent\":\"dot\",\"text\":\"普遍看法；…\",\"fixed\": false },\n" +
                                "  { \"key\":\"dot_view\",\"parent\":\"dot\",\"text\":\"個人見解；…\",\"fixed\": false }\n" +
                                "  /* 其餘節點同規則補齊 */\n" +
                                "]\n";
                case ARGUMENTATIVE ->
                        usermessage = "你是一位結構化資訊抽取與樹狀知識整理助理。請依據我們的對話內容，將內容整理成**樹狀 JSON 陣列**，以便用於樹圖元件顯示。\n" +
                                "\n" +
                                "## 產出要求\n" +
                                "1) **只回傳 JSON 陣列**，不要任何額外說明或前後置文字。  \n" +
                                "2) **不包含換行符號**（整段為單行 JSON）。  \n" +
                                "3) **字元編碼**以 UTF-8 為準；如文本含引號請正確跳脫。  \n" +
                                "4) **每個節點物件**都必須包含：`key`, `parent`, `text`, `fixed` 四個欄位。  \n" +
                                "\n" +
                                "## 結構與鍵值（嚴格遵守）\n" +
                                "- 根節點（唯一，`fixed=false`）  \n" +
                                "  { \"key\": \"root\", \"text\": \"議論文\", \"fixed\": true }\n" +
                                "\n" +
                                "- 第二層（皆為 root 的子節點，`fixed=true`）  \n" +
                                "  { \"key\": \"intro\", \"parent\": \"root\", \"text\": \"引論\", \"fixed\": true }  \n" +
                                "  { \"key\": \"body\", \"parent\": \"root\", \"text\": \"本論\", \"fixed\": true }  \n" +
                                "  { \"key\": \"conclusion\", \"parent\": \"root\", \"text\": \"結論\", \"fixed\": true }  \n" +
                                "\n" +
                                "- 第三層（摘要節點，皆 `fixed=false`）  \n" +
                                "  - intro 底下：提出發現的問題點、核心論點  \n" +
                                "  - body 底下：論點一（含論據、論證）、論點二（含論據、論證）、論點三（含論據、論證）  \n" +
                                "  - conclusion 底下：提出解決方法或總結論點  \n" +
                                "\n" +
                                "## 節點格式範本\n" +
                                "{\n" +
                                "  \"key\": \"<固定代號或自定唯一鍵>\",\n" +
                                "  \"parent\": \"<父層 key>\",\n" +
                                "  \"text\": \"<條列且精煉的內容摘要，必要時用；分隔子點，每個摘要須15字元以內>\",\n" +
                                "  \"fixed\": false\n" +
                                "}\n" +
                                "\n" +
                                "## 摘要與取捨原則\n" +
                                "- 引論：先指出問題，再提出核心論點。  \n" +
                                "- 本論：逐一展開「論點一、二、三」，並包含論據與論證。  \n" +
                                "- 結論：針對問題提出解決方法，或總結前文核心觀點。  \n" +
                                "- **每個 `text` 字串長度須控制在 15 字元以內，避免過長敘述。**  \n" +
                                "- 原文若有缺漏或完全無法判定，則不產出節點。。  \n" +
                                "\n" +
                                "## 驗收清單\n" +
                                "- ✅ 只輸出單一 JSON 陣列。  \n" +
                                "- ✅ root 與三大綱要（intro/body/conclusion）均存在且 `fixed=true`。  \n" +
                                "- ✅ 各綱要底下皆有指定的第三層摘要節點，且 `fixed=false`。  \n" +
                                "- ✅ 各 `text` 長度必須在 15 字元以內。  \n" +
                                "- ✅ 可直接載入樹圖元件，互動邏輯正確。  \n" +
                                "\n" +
                                "## 最終輸出示意\n" +
                                "[\n" +
                                "  { \"key\":\"root\",\"text\":\"議論文\",\"fixed\": true },\n" +
                                "  { \"key\":\"intro\",\"parent\":\"root\",\"text\":\"引論\",\"fixed\": true },\n" +
                                "  { \"key\":\"body\",\"parent\":\"root\",\"text\":\"本論\",\"fixed\": true },\n" +
                                "  { \"key\":\"conclusion\",\"parent\":\"root\",\"text\":\"結論\",\"fixed\": true },\n" +
                                "  { \"key\":\"intro_problem\",\"parent\":\"intro\",\"text\":\"問題點\",\"fixed\":false },\n" +
                                "  { \"key\":\"intro_core\",\"parent\":\"intro\",\"text\":\"核心論點\",\"fixed\": false },\n" +
                                "  { \"key\":\"body_arg1\",\"parent\":\"body\",\"text\":\"論點一；論據；論證\",\"fixed\": false },\n" +
                                "  { \"key\":\"body_arg2\",\"parent\":\"body\",\"text\":\"論點二；論據；論證\",\"fixed\": false },\n" +
                                "  { \"key\":\"body_arg3\",\"parent\":\"body\",\"text\":\"論點三；論據；論證\",\"fixed\": false },\n" +
                                "  { \"key\":\"conclusion_summary\",\"parent\":\"conclusion\",\"text\":\"解法或總結\",\"fixed\": false }\n" +
                                "]\n";
            }
        }
        inputs.add(ResponseInputItem.ofMessage(ResponseInputItem.Message.builder()
                .addInputTextContent(usermessage)
                .role(ResponseInputItem.Message.Role.USER)
                .build()));

        ResponseCreateParams responseCreateParams = ResponseCreateParams.builder()
                .input(ResponseCreateParams.Input.ofResponse(inputs)).model(ChatModel.GPT_5_MINI)
                .build();

        saveChatLogs(chatPageModel, Collections.singletonList(usermessage), EventType.READY_TO_SEND_TREE_PROMPT);
        AtomicReference<String> responseid = new AtomicReference<>("");
        AtomicReference<String> messageid = new AtomicReference<>("");
        List<ResponseOutputText> outputs = new ArrayList<>();
        logger.debug(AIMarker.READY_TO_SEND_TREE_PROMPT, "{} - {}", previousid, DTUtils.getISODateTime());
        saveChatLogs(chatPageModel, Collections.singletonList(usermessage), EventType.READY_TO_SEND_TREE_PROMPT);
        openAIClientAsync.responses().create(responseCreateParams)
                .thenAccept(response -> {
                    responseid.set(response.previousResponseId().orElseGet(previousid::get));
                    messageid.set(response.id());
                    response.output().stream()
                            .flatMap(responseOutputItem -> responseOutputItem.message().stream())
                            .flatMap(responseOutputMessage -> responseOutputMessage.content().stream())
                            .flatMap(content -> content.outputText().stream()).forEach(
                                    outputs::add
                            );
                }).join();

        String airesponse = outputs.stream().map(ResponseOutputText::text).collect(Collectors.joining());
        logger.debug(AIMarker.GOT_AI_TREE_RESPONSE, "{} - {}", previousid, DTUtils.getISODateTime());
        saveChatLogs(chatPageModel, Collections.singletonList(airesponse), EventType.GOT_AI_TREE_RESPONSE);
        return new OpenAITreeResponsePushMessage(airesponse, messageid.get(), responseid.get());
    }


    /**
     * 進行AI作文評分
     *
     * @param openAIClientAsync
     * @param previousid
     * @param compose           作文內容
     * @param vectorid
     * @param chatPageModel
     * @return
     */
    public OpenAIResponseIDPushMessage doSendWritingJudgePrompt(OpenAIClientAsync openAIClientAsync, Optional<String> previousid, String compose, Optional<String> vectorid, ChatPageModel chatPageModel) {
        logger.debug("doSendWritingJudgePrompt : 作文評分Prompt");
        List<ResponseInputItem> inputs = new ArrayList<>();
        List<String> prompts = new ArrayList<>();

        ResponseInputItem.Message.Builder systemBuilder = ResponseInputItem.Message.builder();
        List<String> systemPrompts = AISystemPrompts.createLLMWritingSystemPrompts(chatPageModel);
        systemBuilder.addInputTextContent(String.join("\n", systemPrompts));
        prompts.add(String.join("\n", systemPrompts));
        inputs.add(ResponseInputItem.ofMessage(systemBuilder.role(ResponseInputItem.Message.Role.SYSTEM)
                .build()));

        ResponseInputItem.Message.Builder userBuilder = ResponseInputItem.Message.builder();
        userBuilder.addInputTextContent(compose);
        prompts.add(compose);
        inputs.add(ResponseInputItem.ofMessage(userBuilder.role(ResponseInputItem.Message.Role.USER)
                .build()));

        ResponseCreateParams responseCreateParams = ResponseCreateParams.builder()
                .input(ResponseCreateParams.Input.ofResponse(inputs)).model(ChatModel.GPT_4O)
                .build();

        saveChatLogs(chatPageModel, prompts, EventType.READY_TO_SEND_JUDGE_COMPOSE);
        AtomicReference<String> responseid = new AtomicReference<>("");
        AtomicReference<String> messageid = new AtomicReference<>("");
        List<ResponseOutputText> outputs = new ArrayList<>();
        logger.debug(AIMarker.READY_TO_SEND_JUDGE_COMPOSE, "{} - {}", previousid, DTUtils.getISODateTime());
        openAIClientAsync.responses().create(responseCreateParams)
                .thenAccept(response -> {
                    responseid.set(response.previousResponseId().orElseGet(previousid::get));
                    messageid.set(response.id());
                    response.output().stream()
                            .flatMap(responseOutputItem -> responseOutputItem.message().stream())
                            .flatMap(responseOutputMessage -> responseOutputMessage.content().stream())
                            .flatMap(content -> content.outputText().stream()).forEach(
                                    outputs::add
                            );
                }).join();

        //String airesponse = "";//""作文：".concat(compose).concat("\r\n\r\n");//加入作文原文
        String airesponse = "\n### 2\uFE0F⃣ AI評語：\n".concat(outputs.stream().map(ResponseOutputText::text).collect(Collectors.joining()));
        logger.debug(AIMarker.GOT_AI_JUDGE_RESPONSE, "{} - {}", previousid, DTUtils.getISODateTime());
        saveChatLogs(chatPageModel, Collections.singletonList(airesponse), EventType.GOT_AI_JUDGE_RESPONSE);
        return new OpenAIResponseIDPushMessage(airesponse, messageid.get(), responseid.get(), AIConstants.WEBSOCKET_MESSAGE_TYPE.JUDGEPROMPT);
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
     * 寫入對話記錄
     *
     * @param chatPageModel
     * @param messages
     * @param eventType
     */
    protected void saveChatLogs(ChatPageModel chatPageModel, List<String> messages, EventType eventType) {
        CDI.current().select(ChatLogsService.class).get()
                .addChatLogs(chatPageModel, Strings.join("\n", messages), eventType);
    }
}
