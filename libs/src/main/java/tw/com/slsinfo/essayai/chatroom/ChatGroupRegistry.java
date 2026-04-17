package tw.com.slsinfo.essayai.chatroom;

import com.openai.models.ChatModel;
import jakarta.annotation.Resource;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.spi.CDI;
import jakarta.inject.Inject;
import org.apache.commons.lang3.StringUtils;
import org.apache.wicket.Application;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.databases.mongo.entities.ChatLogs;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;
import tw.com.slsinfo.essayai.models.GenreType;
import tw.com.slsinfo.essayai.models.course.LLMStageQuestionsModel;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.essayai.models.openai.OpenAIResponseIDPushMessage;
import tw.com.slsinfo.essayai.models.openai.OpenAITreeResponsePushMessage;
import tw.com.slsinfo.essayai.openai.OpenAIApiClientSingleton;
import tw.com.slsinfo.essayai.services.ChatLogsService;
import tw.com.slsinfo.essayai.services.EssayquestionService;
import tw.com.slsinfo.essayai.services.OpenAIWritingChatUpdaterService;
import tw.com.slsinfo.essayai.utils.AIConstants;
import tw.com.slsinfo.essayai.utils.AISystemPrompts;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 用來記錄群組成員及對話順序的Payload
 */
@ApplicationScoped
public class ChatGroupRegistry {

    private static final Logger logger = LoggerFactory.getLogger(ChatGroupRegistry.class);
    private final ConcurrentMap<Integer, GroupState> groups = new ConcurrentHashMap<>();

    @Inject
    private OpenAIWritingChatUpdaterService openAIWritingChatUpdaterService;
    /**
     * LLM問題庫
     */
    @Inject
    private EssayquestionService essayquestionService;

    @Resource(lookup = "java:comp/DefaultManagedExecutorService")
    private ExecutorService executorService;


    public void cleanUp() {
        groups.clear();
    }

    /**
     * 移除登出的用戶
     *
     * @param sessionId
     */
    public void removeSession(String sessionId) {
        groups.forEach((groupId, groupState) -> {
            logger.debug("Before Session remove groupId={}, groupState={}", groupId, groupState);
            groupState.getGroupMembers().removeIf(groupMember -> groupMember.sessionId().equals(sessionId));
            groupState.getPhaseGroupMembers().removeIf(groupMember -> groupMember.sessionId().equals(sessionId));
            logger.debug("After Session remove groupId={}, groupState={}", groupId, groupState);
        });
    }

    /**
     * @param groupId      group id
     * @param expectedSize 預期小組成員數，可從DB查詢得來
     * @param minQuorum    最小可進入聊天室數組員數
     * @param joinWindow   N分鐘後自動進入會議室
     */
    public GroupState getOrCreateGroup(int groupId, int expectedSize, int minQuorum, Duration joinWindow) {
        return groups.computeIfAbsent(groupId, k -> new GroupState(k, expectedSize, minQuorum, joinWindow));
    }

    /**
     * 預設3分鐘後自動進入聊天室
     *
     * @param groupId      group id
     * @param expectedSize 預期小組成員數，可從DB查詢得來
     * @param minQuorum    最小可進入聊天室數組員數
     */
    public GroupState getOrCreateGroup(int groupId, int expectedSize, int minQuorum) {
        return groups.computeIfAbsent(groupId, k -> new GroupState(k, expectedSize, minQuorum));
    }

    /**
     * @param groupId
     * @param expectedSize
     * @param joinWindow
     * @return
     */
    public GroupState getOrCreateGroup(int groupId, int expectedSize, Duration joinWindow) {
        return groups.computeIfAbsent(groupId, k -> new GroupState(k, expectedSize, 1 + (expectedSize / 2), joinWindow));
    }

    /**
     * 預設以3人為小組，並且2人以上就可自動進入聊天室
     *
     * @param groupId    group id
     * @param joinWindow N分鐘後自動進入會議室
     */
    public GroupState getOrCreateGroup(int groupId, Duration joinWindow) {
        return groups.computeIfAbsent(groupId, k -> new GroupState(k, joinWindow));
    }

    /**
     * 取得小組狀態
     *
     * @param groupId
     * @return
     */
    public GroupState getGroup(int groupId) {
        return groups.getOrDefault(groupId, null);
    }


    /**
     * @param groupId
     * @param generator
     * @return
     */
    public String sharedGroupMessageId(int groupId, Supplier<String> generator) {
        return groups.get(groupId).getOrCreateShareGroupMessageId(generator);
    }

    /**
     * 新進組員加入小組之中，並引發ChatEventType.JOIN，前提是小組GroupState必須存在，也就是Page那端必須先建立小組
     *
     * @param groupId
     * @param groupMember
     * @param chatPageModel 下一階段帶入的訊息
     * @param eventSink
     */
    public void joinGroupInLobby(GroupState group, int groupId, GroupMember groupMember, Optional<ChatPageModel> chatPageModel, Consumer<ChatEvent> eventSink) {
        logger.debug("joinGroup(groupId, groupMember, chatPageModel, eventSink)");
        group.getGroupMembers().add(groupMember);
        //consume ChatEvent and send websocket update
        eventSink.accept(new ChatEvent(groupId, ChatEventType.MEMBER_JOINED, chatPageModel, groupMember));

        if (chatPageModel.isPresent() && StringUtils.isNotBlank(chatPageModel.get().getPreviousId())) {
            //如果有previous message id
            eventSink.accept(new ChatEvent(groupId, ChatEventType.HAS_PREVIOUS_CHAT_MSG_ID, chatPageModel, chatPageModel.get().getMessageId()));
            raiseJoinEvent(group, groupId, groupMember, chatPageModel, eventSink);
        } else {
            //如果是第一次進入，則要進行AI對話，並取得ID，同時鎖定第一位進入的組員
            if (group.getGroupMembers().size() == 1) {
                //conversation with ai to gain first message id
                logger.debug("如果是第一次進入，則要進行AI對話，設定SystemPrompt");
                var messageId = group.getOrCreateShareGroupMessageId(() -> {
                    List<String> systemPrompts = AISystemPrompts.createLLMWritingSystemPrompts(chatPageModel.get());
                    eventSink.accept(new ChatEvent(groupId, ChatEventType.WAITING_GEN_MSG_ID, chatPageModel, groupMember));
                    return openAIWritingChatUpdaterService.doSetGroupAsyncSystemPrompt(
                            OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(30)),
                            systemPrompts, Optional.of(AIConstants.VECTOR_ID_LLM4WRITING), ChatModel.GPT_4O
                    );
                });
                eventSink.accept(new ChatEvent(groupId, ChatEventType.GEN_FIRST_CHAT_MSG_ID, chatPageModel, messageId));
                raiseJoinEvent(group, groupId, groupMember, chatPageModel, eventSink);
            } else {
                if (!group.hasShareGroupMessageId()) {
                    logger.debug("等待產生對話ID中");
                    eventSink.accept(new ChatEvent(groupId, ChatEventType.WAITING_GEN_MSG_ID, chatPageModel, groupMember));
                } else {
                    logger.debug("對話ID已產生....{}", group.getShareGroupMessageId());
                    eventSink.accept(new ChatEvent(groupId, ChatEventType.GEN_FIRST_CHAT_MSG_ID, chatPageModel,
                            group.getShareGroupMessageId()));
                    raiseJoinEvent(group, groupId, groupMember, chatPageModel, eventSink);
                }
            }
        }
    }


    /**
     * 加入個人與AI對話學習
     *
     * @param chatPageModel
     * @param eventSink
     */
    public void joinPersonalPhase(Optional<ChatPageModel> chatPageModel, Consumer<ChatEvent> eventSink) {
        eventSink.accept(new ChatEvent(0, ChatEventType.USER_ENTER_PERSONAL_PHASE, chatPageModel, null));
        eventSink.accept(new ChatEvent(0, ChatEventType.PERSONAL_PENDING_FIRST_TIME_AI_RESPONSE, chatPageModel, null));
//        var responsemsg =  openAIWritingChatUpdaterService.doSendGroupAIAsyncPrompt(
//                    OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(30)),
//                    Optional.of(chatPageModel.get().getPreviousId()),
//                    AISystemPrompts.createLLMWritingSystemPrompts(chatPageModel.get()),
//                    Collections.emptyList(), Optional.of(AIConstants.VECTOR_ID_LLM4WRITING));

        AtomicReference<String> phasemsg = new AtomicReference<>();

        switch (chatPageModel.get().getActive()) {
            case 3 -> phasemsg.set(AIConstants.Phase3Opening);
//            case 5 -> {
//                ChatLogsService chatLogsService = CDI.current().select(ChatLogsService.class).get();
//                String summary = Stream.of(
//                                new AbstractMap.SimpleEntry<>("## 階段一：\n",
//                                        chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), 1, false)),
//                                new AbstractMap.SimpleEntry<>("## 階段二：\n",
//                                        chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), 2, false)),
//                                new AbstractMap.SimpleEntry<>("## 階段三：\n",
//                                        chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), chatPageModel.get().getUserid(), 3, false)),
//                                new AbstractMap.SimpleEntry<>("## 階段四：\n",
//                                        chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), 4, false))
//                        )
//                        .flatMap(entry -> entry.getValue().stream()
//                                .map(log -> entry.getKey() + log.getMessage()))
//                        .collect(Collectors.joining("\n"));
//                phasemsg.set(summary);
//            }
            //phasemsg.set(AIConstants.Phase5Opening);//直接覆寫成摘要
            case 6 -> phasemsg.set(AIConstants.Phase6Opening);
            case 8 -> phasemsg.set(AIConstants.Phase8Opening);
            case 9 -> phasemsg.set(AIConstants.Phase9Opening);
            default -> phasemsg.set("");
        }

        var responsemsg = openAIWritingChatUpdaterService.doSendGroupAIAsyncPrompt(
                OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(30)),
                Optional.of(chatPageModel.get().getPreviousId()),
                AISystemPrompts.createLLMWritingSystemPrompts(chatPageModel.get()),
                Collections.emptyList(),
                Optional.of(AIConstants.VECTOR_ID_LLM4WRITING), chatPageModel.get());


        if (StringUtils.isNotBlank(phasemsg.get())) {
            responsemsg.getAiResponseModel().setContent(phasemsg.get());
        }
        eventSink.accept(new ChatEvent(0, ChatEventType.PERSONAL_GENERATED_FIRST_TIME_AI_RESPONSE, chatPageModel, responsemsg));
    }


    public void joinPersonalJudgePhase(Optional<ChatPageModel> chatPageModel, String compose, Consumer<ChatEvent> eventSink) {
        eventSink.accept(new ChatEvent(0, ChatEventType.USER_ENTER_PERSONAL_PHASE, chatPageModel, null));
        eventSink.accept(new ChatEvent(0, ChatEventType.PENDING_AI_JUDGE_RESPONSE, chatPageModel, null));

        eventSink.accept(new ChatEvent(0, ChatEventType.AI_JUDGE_RESPONSE, chatPageModel, openAIWritingChatUpdaterService.doSendWritingJudgePrompt(
                OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(30)),
                Optional.of(chatPageModel.get().getPreviousId()),
                compose, Optional.of(AIConstants.VECTOR_ID_LLM4WRITING), chatPageModel.get())));
    }


    /**
     * 產生開頭詞
     *
     * @param group
     * @param groupId
     * @param groupMember
     * @param chatPageModel
     * @param eventSink
     */
    public void joinGroupOpeningInPhase(GroupState group, int groupId, GroupMember groupMember, Optional<ChatPageModel> chatPageModel, Consumer<ChatEvent> eventSink) {
        group.getPhaseGroupMembers().add(groupMember);
        group.getGroupMembers().add(groupMember);
        //consume ChatEvent and send websocket update
        eventSink.accept(new ChatEvent(groupId, ChatEventType.MEMBER_JOINED, chatPageModel, groupMember));
        logger.debug("Phase Group {} has {} members", groupId, group.getGroupMembers().size());
        //鎖定第一個進入的組員會無效，因為同一小組ID，前後進入，組員人數就不會是1
        //20251020改為固定開場，這部份就不呼叫LLM，改為固定輸出

        if (group.getPhaseGroupMembers().size() == 1) {
            AtomicReference<String> phasemsg = new AtomicReference<>();
            //目前群組對話只剩1,2,4
            switch (chatPageModel.get().getActive()) {
                case 1 -> phasemsg.set(AIConstants.Phase1Opening);
                case 2 -> phasemsg.set(AIConstants.Phase2Opening);
                case 4 -> phasemsg.set(AIConstants.Phase4Opening);
                default -> phasemsg.set("");
            }
            var responsemsg = new OpenAIResponseIDPushMessage(phasemsg.get(), null, null, AIConstants.WEBSOCKET_MESSAGE_TYPE.OPENING);
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GENERATED_OPENING, chatPageModel, responsemsg));
            raiseJoinEvent(group, groupId, groupMember, chatPageModel, eventSink);
        } else {
            if (!group.hasOpenAIResponseIDPushMessage()) {
                logger.debug("等待開頭詞中 : {}", groupMember.uid());
                eventSink.accept(new ChatEvent(groupId, ChatEventType.OPENING_PENDING, chatPageModel, groupMember));
            } else {
                logger.debug("開頭詞回覆已產生....{}", group.getShareGroupMessageId());
                eventSink.accept(new ChatEvent(groupId, ChatEventType.GENERATED_OPENING, chatPageModel, group.getOpenAIResponseIDPushMessage()));
                raiseJoinEvent(group, groupId, groupMember, chatPageModel, eventSink);
            }

        }
    }


    public void joinPersonalOpeningPhase(Optional<ChatPageModel> chatPageModel, Consumer<ChatEvent> eventSink) {

        AtomicReference<String> phasemsg = new AtomicReference<>();
        logger.debug("Personal Opening....");
        switch (chatPageModel.get().getActive()) {
            case 3 -> phasemsg.set(AIConstants.Phase3Opening);
            case 5 ->
//            {
//                ChatLogsService chatLogsService = CDI.current().select(ChatLogsService.class).get();
////                String summary = Stream.of(
////                                chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), 1, false),
////                                chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), 2, false),
////                                chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), chatPageModel.get().getUserid(), 3, false),
////                                chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), 4, false)
////                        )
////                        .flatMap(List::stream)
////                        .map(ChatLogs::getMessage)
////                        .collect(Collectors.joining("\n"));
//                String summary = Stream.of(
//                                new AbstractMap.SimpleEntry<>("階段一：",
//                                        chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), 1, false)),
//                                new AbstractMap.SimpleEntry<>("階段二：",
//                                        chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), 2, false)),
//                                new AbstractMap.SimpleEntry<>("階段三：",
//                                        chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), chatPageModel.get().getUserid(), 3, false)),
//                                new AbstractMap.SimpleEntry<>("階段四：",
//                                        chatLogsService.getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), 4, false))
//                        )
//                        .flatMap(entry -> entry.getValue().stream()
//                                .map(log -> entry.getKey() + log.getMessage()))
//                        .collect(Collectors.joining("\n"));
//                phasemsg.set(summary);
//            }
                    phasemsg.set(AIConstants.Phase5Opening);//直接覆寫成摘要
            case 6 -> phasemsg.set(AIConstants.Phase6Opening);
            case 8 -> phasemsg.set(AIConstants.Phase8Opening);
            case 9 -> phasemsg.set(AIConstants.Phase9Opening);
            default -> phasemsg.set("");
        }
        logger.debug("phasemsg: {}", phasemsg.get());
        var responsemsg = new OpenAIResponseIDPushMessage(phasemsg.get(), null, null, AIConstants.WEBSOCKET_MESSAGE_TYPE.OPENING);
        eventSink.accept(new ChatEvent(0, ChatEventType.GENERATED_OPENING, chatPageModel, responsemsg));
    }

    /**
     * 在不同學習活動中，處理組員加入行為，
     *
     * @param group
     * @param groupId
     * @param groupMember
     * @param chatPageModel
     * @param eventSink
     */
    public void joinGroupInPhase(GroupState group, int groupId, GroupMember groupMember, Optional<ChatPageModel> chatPageModel, Consumer<ChatEvent> eventSink) {
        logger.debug("joinGroupInPhase(groupId, groupMember, chatPageModel, eventSink)");


        group.getPhaseGroupMembers().add(groupMember);
        group.getGroupMembers().add(groupMember);
        //consume ChatEvent and send websocket update
        eventSink.accept(new ChatEvent(groupId, ChatEventType.MEMBER_JOINED, chatPageModel, groupMember));
        logger.debug("Phase Group {} has {} members", groupId, group.getGroupMembers().size());
        //鎖定第一個進入的組員會無效，因為同一小組ID，前後進入，組員人數就不會是1
        //20251020改為固定開場，這部份就不呼叫LLM，改為固定輸出
        //1,2,4階段要取得LLM問題庫
        int active = chatPageModel.get().getActive();
        if (group.getPhaseGroupMembers().size() == 1) {
            group.clearOpenAIResponseIDPushMessage();
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_PENDING_FIRST_TIME_AI_RESPONSE, chatPageModel, groupMember));
            logger.debug("Phase ? : {}", active);
            if (active == 1 || active == 2) {
                logger.debug("Ready to query llm questions");
                group.getLlmquestionset().clear();
                int questions = essayquestionService.getLLMStageQuestionSetByIds(chatPageModel.get().getEssayid(),
                        active).size();
                logger.debug("Essay id {}  and Active  {} - Found {} questions", chatPageModel.get().getEssayid(), active, questions);
                group.setLlmquestionset(
                        essayquestionService.getLLMStageQuestionSetByIds(chatPageModel.get().getEssayid(),
                                active));
                group.getLlmquestionset().forEach(question -> {
                    logger.debug("Llm question {}", question);
                });
            }

            AtomicReference<String> phasemsg = new AtomicReference<>();
            //目前群組對話只剩1,2,4
            switch (active) {
                case 1 -> phasemsg.set(AIConstants.Phase1Opening);
                case 2 -> phasemsg.set(AIConstants.Phase2Opening);
                case 4 -> phasemsg.set(AIConstants.Phase4Opening);
                default -> phasemsg.set("");
            }

            logger.debug("phasemsg: {} - {}", active, phasemsg.get());
            List<String> systemPrompts = AISystemPrompts.createLLMWritingSystemPrompts(chatPageModel.get());
            logger.debug("Phase {} original systemPrompts: {}", active, systemPrompts);

            if (active == 1 || active == 2) {
                ConcurrentSkipListSet<LLMStageQuestionsModel> questionsModels
                        = (ConcurrentSkipListSet<LLMStageQuestionsModel>) group.getLlmquestionset();
                LLMStageQuestionsModel questionsModel = questionsModels.pollFirst();
                String q1 = questionsModel.getQuestion();
                logger.debug("Phase {} - Q1 {}", active, q1);
                String hint = "\n ---\n ## \uD83D\uDC4B 請回答以下問題！\n";
                logger.debug("HINT : {}", hint);
                if (questionsModel.getType()) {
                    logger.debug("llm questions type :{}", questionsModel.getType());
                    logger.debug("llm questions ai prompt : {}", questionsModel);
                    //true : ai prompt
                    systemPrompts.add("\n - 接下來要請你依照規則以及範例問題，針對討論的內容進行問題生成**".concat(q1).concat("**。然後只提出##一個##適當的問題詢問學生。"));
                } else {
                    //false : fixed pompt
                    logger.debug("llm questions fixed prompt : {}", questionsModel);
                    systemPrompts.add("請在最後回覆時，詢問以下問題：，**".concat(q1).concat("**。"));
                    logger.debug(phasemsg.get().concat(hint).concat(q1));
                    phasemsg.set(phasemsg.get().concat(hint).concat(q1));
                }
            }

            logger.debug("Phase {} added systemPrompts: {}", active, systemPrompts);
            OpenAIResponseIDPushMessage responsemsg = null;
            if (active == 1 || active == 4) {
                responsemsg = group.getOrCreateOpenAIResponseIDPushMessage(() -> {
                    logger.debug("Phase {} started ai prompt : {}", active, systemPrompts);
                    eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_PENDING_FIRST_TIME_AI_RESPONSE, chatPageModel, groupMember));
                    logger.debug("Phase {} GROUP_PENDING_FIRST_TIME_AI_RESPONSE", active);
                    return openAIWritingChatUpdaterService.doSendGroupAIAsyncPrompt(
                            OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(30)),
                            Optional.of(chatPageModel.get().getPreviousId()),
                            systemPrompts, Collections.emptyList(), Optional.of(AIConstants.VECTOR_ID_LLM4WRITING), chatPageModel.get());
                });
                logger.debug("Phase 1 Joint Group AI ResponseMsg : {}\n{}", active, responsemsg.getAiResponseModel().getContent());
            }


            if (active == 2) {
                String keywork = "### **請回答以下問題**";
                eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_PENDING_FIRST_TIME_AI_RESPONSE, chatPageModel, groupMember));
                responsemsg =
                        openAIWritingChatUpdaterService.doSendGroupAIAsyncPrompt(
                                OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(30)),
                                Optional.of(chatPageModel.get().getPreviousId()),
                                systemPrompts, Collections.emptyList(), Optional.of(AIConstants.VECTOR_ID_LLM4WRITING), chatPageModel.get());
                group.setOpenAIResponseIDPushMessage(responsemsg);
                logger.debug("Phase 2 Joint Group AI ResponseMsg : {}\n{}", active, responsemsg.getAiResponseModel().getContent());
                String resp = responsemsg.getAiResponseModel().getContent();
                int index = resp.indexOf(keywork);
                logger.debug("Had Keyword : {}", index);
                if (index != -1) {
                    String question = resp.substring(
                            resp.indexOf(keywork)
                    );
                    phasemsg.set(phasemsg.get().concat(question));
                    logger.debug("Join Group Active 2 Opening : {}", phasemsg.get());
                    group.setOpenAIResponseIDPushMessage(responsemsg);
                } else {
                    logger.debug("Join Group Active 2 Opening Cannot get index");
                    phasemsg.set(AIConstants.Phase2Opening);
                    logger.debug("Join Group Active 2 Opening No Question : {}", phasemsg.get());
                }
            }
            responsemsg.getAiResponseModel().setContent(phasemsg.get());
            group.setOpenAIResponseIDPushMessage(responsemsg);
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_GENERATED_FIRST_TIME_AI_RESPONSE, chatPageModel, responsemsg));
            raiseJoinEvent(group, groupId, groupMember, chatPageModel, eventSink);
        } else {
            if (!group.hasOpenAIResponseIDPushMessage()) {
                logger.debug("等待產生第一次AI回覆中 : {}", groupMember.uid());
                eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_PENDING_FIRST_TIME_AI_RESPONSE, chatPageModel, groupMember));
            } else {
                logger.debug("第一次AI回覆已產生....{}", group.getShareGroupMessageId());
                eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_GENERATED_FIRST_TIME_AI_RESPONSE, chatPageModel, group.getOpenAIResponseIDPushMessage()));
                raiseJoinEvent(group, groupId, groupMember, chatPageModel, eventSink);
            }

        }


    }

    /**
     * 組員加入事件共通處理函式
     *
     * @param group
     * @param groupId
     * @param groupMember
     * @param chatPageModel
     * @param eventSink
     */
    private void raiseJoinEvent(GroupState group, int groupId, GroupMember
            groupMember, Optional<ChatPageModel> chatPageModel, Consumer<ChatEvent> eventSink) {
        if (group.allMembersPresent()) {
            //就送出READY，讓前端頁面進下一步驟
            eventSink.accept(new ChatEvent(groupId, ChatEventType.ALL_READY, chatPageModel, groupMember));
        } else if (group.quorumReached()) {
            //最小人數已到齊，讓前端頁面也可以進下一步驟
            eventSink.accept(new ChatEvent(groupId, ChatEventType.REACH_QUORUM, chatPageModel, groupMember));
        } else if (group.joinWindowExpired()) {
            //已經到達等待時間上限，自動下一步驟
            eventSink.accept(new ChatEvent(groupId, ChatEventType.REACH_DEADLINE, chatPageModel, groupMember));
        } else if (group.hasStarted()) {
            //如果學生加入時討論已開始，就自動進去下一步驟
            eventSink.accept(new ChatEvent(groupId, ChatEventType.CHAT_STARTED, chatPageModel, groupMember));
        }
    }

    /**
     * 組員離開小組
     *
     * @param group
     * @param groupId
     * @param groupMember
     * @param eventSink
     * @param notify      是否通知小組人數不足
     */
    public void leaveGroup(GroupState group, int groupId, GroupMember groupMember, Consumer<ChatEvent> eventSink,
                           boolean notify) {
        logger.debug("Leaving group {}, groupId {}", groupId, groupMember);
        if (group == null) {
            logger.debug("groupstate {} is null", group);
            group = getGroup(groupId);
        }
        group.getPhaseGroupMembers().remove(groupMember);
        group.getGroupMembers().remove(groupMember);
        group.getPendingAiTreeResponse().set(false);
        group.getPendingAiResponse().set(false);
        group.getPendingAiSummary().set(false);
        logger.debug("Group members after remove : {}", group.getGroupMembers().size());
        eventSink.accept(new ChatEvent(groupId, ChatEventType.MEMBER_LEAVE, Optional.empty(), groupMember));
        if (notify && !group.quorumReached()) {
            //最小人數已不足，讓前端頁面取消下一步驟
            eventSink.accept(new ChatEvent(groupId, ChatEventType.MEMBER_LOWER, Optional.empty(), groupMember));
        }

    }

    /**
     * 登出時呼叫，同步讓小組成員知道
     *
     * @param groupId
     * @param eventSink
     */
    public void leaveGroupOnLogout(int groupId, Consumer<ChatEvent> eventSink) {
        logger.debug("Leaving  groupId {}", groupId);
        GroupState group = getGroup(groupId);
        group.getPendingAiTreeResponse().set(false);
        group.getPendingAiResponse().set(false);
        group.getPendingAiSummary().set(false);
        eventSink.accept(new ChatEvent(groupId, ChatEventType.MEMBER_LEAVE, Optional.empty(), ""));
    }

    /**
     * 小組往下一階段<br>
     * 會在小組
     *
     * @param group
     * @param groupId
     * @param groupMember
     * @param eventSink
     * @param notify
     */
    public void memberLeaveGroupPhase(GroupState group, int groupId, GroupMember groupMember, Consumer<ChatEvent> eventSink,
                                      boolean notify) {
        logger.debug("Member {} leaving groupId {}", groupMember, groupId);
        if (group == null) {
            logger.debug("groupstate {} is null", group);
            group = getGroup(groupId);
        }
        group.getPhaseGroupMembers().remove(groupMember);
        group.getGroupMembers().remove(groupMember);
        group.getPendingAiTreeResponse().set(false);
        group.getPendingAiResponse().set(false);
        group.getPendingAiSummary().set(false);
        logger.debug("Group members after remove : {}", group.getGroupMembers().size());
        eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_MEMBER_GO_TO_NEXT_PHASE, Optional.empty(), groupMember));
    }

    /**
     * 張貼訊息，個人對話
     *
     * @param uid
     * @param chatPageModel
     * @param message
     * @param eventSink
     */
    public void postPersonalMessage(int uid, Optional<ChatPageModel> chatPageModel, String message, Consumer<ChatEvent> eventSink) {
        eventSink.accept(new ChatEvent(0, ChatEventType.PERSONAL_NEW_MESSAGE, Optional.empty(), new ChatMessage(uid, message)));
        eventSink.accept(new ChatEvent(0, ChatEventType.PERSONAL_PENDING_AI_RESPONSE, Optional.empty(), new ChatMessage(uid, message)));

        ChatPageModel model = chatPageModel.get();
        List<String> systemPrompts = AISystemPrompts.createLLMWritingSystemPrompts(model);


        OpenAIResponseIDPushMessage openAIResponseIDPushMessage
                = openAIWritingChatUpdaterService.doSendGroupAIAsyncPrompt(
                OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(30)),
                Optional.of(model.getPreviousId()),
                systemPrompts,
                Collections.singletonList(message), Optional.of(AIConstants.VECTOR_ID_LLM4WRITING), model);
        //AI回覆訊息
        //如果是2-4階段也就是phase9，必須依照對話次數進行不同prompt
        if (model.getActive() == 9) {
            logger.debug("Active 9, Turns : {}", model.getPturn());
            switch (model.getPturn()) {
                case 2 -> openAIResponseIDPushMessage.getAiResponseModel().setContent(AIConstants.Phase9_Q2);
                case 3 -> openAIResponseIDPushMessage.getAiResponseModel().setContent(AIConstants.Phase9_Q3);
                case 4 -> openAIResponseIDPushMessage.getAiResponseModel().setContent(AIConstants.Phase9_Q4);
            }

        }
        eventSink.accept(new ChatEvent(0, ChatEventType.PERSONAL_AI_RESPONSE, chatPageModel, openAIResponseIDPushMessage));

    }

    /**
     * 張貼訊息，小組對話，如果是第一階段則會以固定方式回覆
     *
     * @param group
     * @param groupId
     * @param uid
     * @param chatPageModel
     * @param message
     * @param eventSink
     * @param questions     如果是第一階段會進行固定回覆提問，目前依CT類型各一題，共六題
     */
    public void postMessage(GroupState group, int groupId, int uid, Optional<ChatPageModel> chatPageModel, String
            message, Consumer<ChatEvent> eventSink, List<String> questions) {
        logger.debug("ready to group postMessage({}, {}, {}, {}, eventSink)", group, groupId, uid, message);
        if (group == null) {
            logger.debug("groupstate {} is null", group);
            group = getGroup(groupId);
        }
        //只有第一階段是固定回覆問題
        //boolean phase1 = !questions.isEmpty();
        //組員張貼訊息
        group.getPostedMembers().computeIfAbsent(uid, k -> new ArrayList<>()).add(message);
        logger.debug("PostedMembers : {}", group.getPostedMembers().size());
        eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_MEMBER_NEW_MESSAGE, Optional.empty(), new ChatMessage(uid, message)));
        //如果小組此次發言數量過了最低門檻，同時是第一位進入，尚未送出AI對話
        logger.debug("Group status : quorum : {} - mingroupmessage : {} ; pendingairesponse : {}", group.quorumMemberPostMessage(), group.minGroupMessagesTouched(), group.isPendingAiResponse());
        if (group.quorumMemberPostMessage() && group.minGroupMessagesTouched() && !group.isPendingAiResponse()) {
            //將AI送出狀態改為True
            group.getPendingAiResponse().compareAndSet(false, true);
            //送出所有訊息給AI
            List<String> userPrompts = new ArrayList<>();
            List<String> systemPrompts = AISystemPrompts.createLLMWritingSystemPrompts(chatPageModel.get());
            group.getPostedMembers().forEach((k, v) ->
                    userPrompts.addAll(v)
            );

            //TODO: 依據DB的essayquestions來動態出現問題
//            if (phase1) {
//                int index = ThreadLocalRandom.current().nextInt(0, questions.size());
//                userPrompts.add("最後請以下面問題來詢問學生們：".concat(questions.get(index)));
//                logger.debug("Phase1 Questions {}", questions.get(index));
//            }

            //1,2階段要取得LLM問題庫
            int active = chatPageModel.get().getActive();
            int chatturns = group.getChatturns().addAndGet(1);
            logger.debug("Current Active Stage : {}, Current Turn : {}", active, chatturns);
            if (active == 1 || active == 2) {
                logger.debug("Ready to query llm questions");
                ConcurrentSkipListSet<LLMStageQuestionsModel> questionsModels
                        = (ConcurrentSkipListSet<LLMStageQuestionsModel>) group.getLlmquestionset();
                logger.debug("llm questions count before : {}", questionsModels.size());
                questionsModels.forEach(questionsModel -> {
                    logger.debug("LLMStageQuestionsModel - Active {} - Turn {} : {}", active, chatturns, questionsModel);
                });
                if (!questionsModels.isEmpty()) {
                    LLMStageQuestionsModel questionsModel = questionsModels.pollFirst();
                    logger.debug("llm questions :{}", StringUtils.defaultIfEmpty(questionsModel.getQuestion(), "NA"));
                    logger.debug("llm questions count after : {}", questionsModels.size());
                    logger.debug("llm questions type : {}", questionsModel.getType());
                    if (questionsModel.getType()) {
                        logger.debug("llm questions type :{}", questionsModel.getType());
                        logger.debug("llm questions ai prompt : {}", questionsModel);
                        //true : ai prompt
                        systemPrompts.add("接下來要請你依照規則以及範例問題，針對討論的內容進行問題生成**".concat(questionsModel.getQuestion()).concat("**。然後只提出##一個##適當的問題詢問學生。"));
                    } else {
                        //false : fixed pompt
                        logger.debug("llm questions fixed prompt : {}", questionsModel);
                        systemPrompts.add("請在最後回覆時，詢問以下問題：，**".concat(questionsModel.getQuestion()).concat("**。"));
                    }
                }

            }

            logger.debug("ready to query llm questions systemprompt : {}", systemPrompts);
            //eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_PENDING_AI_RESPONSE, Optional.empty(), new ChatMessage(uid, message)));
            OpenAIResponseIDPushMessage openAIResponseIDPushMessage
                    = openAIWritingChatUpdaterService.doSendGroupAIAsyncPrompt(
                    OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(30)),
                    Optional.of(chatPageModel.get().getPreviousId()),
                    !systemPrompts.isEmpty() ? systemPrompts : Collections.emptyList(),
                    userPrompts, Optional.of(AIConstants.VECTOR_ID_LLM4WRITING), chatPageModel.get());
            //AI回覆訊息
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_AI_RESPONSE, chatPageModel, openAIResponseIDPushMessage));
            //清除所有對話，重新開始小組與AI的對話
            group.getPostedMembers().clear();
//            if (chatturns >= (phase1 ? 6 : 3)) {
//                //如果對話到五輪後，就可以啓用下一步按鈕
//                eventSink.accept(new ChatEvent(groupId, ChatEventType.REACH_MIN_CHAT_TURNS, chatPageModel, openAIResponseIDPushMessage));
//            }
            group.getPendingAiResponse().compareAndSet(true, false);
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_AI_CHAT_RESTART, chatPageModel, "重新計算：目前貼文人數:".concat(String.valueOf(group.postMessageMembersCount()).concat(" 目前訊息數：").concat(String.valueOf(group.groupMessagesCollectedCount())))));
        } else {
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_MESSAGE_COLLECTING, Optional.empty(),
                    "目前貼文人數:".concat(String.valueOf(group.postMessageMembersCount()).concat(" 目前訊息數：").concat(String.valueOf(group.groupMessagesCollectedCount())))));
        }
    }

    /**
     * 張貼訊息，小組對話
     *
     * @param groupId
     * @param uid
     * @param message
     * @param eventSink
     */
    public void postMessage(GroupState group, int groupId, int uid, Optional<ChatPageModel> chatPageModel, String
            message, Consumer<ChatEvent> eventSink) {
        postMessage(group, groupId, uid, chatPageModel, message, eventSink, new ArrayList<>());
    }


    /**
     * 請AI進行個人對話的摘要
     *
     * @param uid
     * @param chatPageModel
     * @param message
     * @param eventSink
     */
    public void postPersonalSummary(int uid, Optional<ChatPageModel> chatPageModel, String
            message, Consumer<ChatEvent> eventSink) {

        List<ChatLogs> chatlogs = CDI.current().select(ChatLogsService.class)
                .get().getChatPersonalLogsbycgid(chatPageModel.get().getCgid(), chatPageModel.get().getId());

        List<String> prompts = new ArrayList<>();

        prompts.add("**接下來的內容是這階段的對話記錄。**\n");
        prompts.add(chatlogs.stream().map(ChatLogs::getMessage).collect(Collectors.joining("\n")));
        prompts.add(message);
        eventSink.accept(new ChatEvent(0, ChatEventType.PERSONAL_DO_SUMMARY, Optional.empty(), new ChatMessage(uid, message)));
        OpenAIResponseIDPushMessage openAIResponseIDPushMessage
                = openAIWritingChatUpdaterService.doSendGroupAIAsyncPrompt(
                OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(30)),
                Optional.of(chatPageModel.get().getPreviousId()),
                AISystemPrompts.createLLMPostMessageSystemPrompts(),
                prompts, Optional.of(AIConstants.VECTOR_ID_LLM4WRITING), chatPageModel.get());
        //AI回覆訊息
        eventSink.accept(new ChatEvent(0, ChatEventType.PERSONAL_AI_SUMMARY, chatPageModel, openAIResponseIDPushMessage));
        eventSink.accept(new ChatEvent(0, ChatEventType.PERSONAL_READY_GO_TO_NEXT_PHASE, chatPageModel, new ChatMessage(uid, message)));
    }

    /**
     * 請AI進行此次對話的摘要
     *
     * @param group
     * @param groupId
     * @param uid
     * @param chatPageModel
     * @param message
     * @param eventSink
     */
    public void postSummary(GroupState group, int groupId, int uid, Optional<ChatPageModel> chatPageModel, String
            message, Consumer<ChatEvent> eventSink) {
        logger.debug("ready to group postSummary(group, {}, {}, {}, eventSink)", groupId, uid, message);
        if (group == null) {
            logger.debug("groupstate {} is null", group);
            group = getGroup(groupId);
        }

        List<ChatLogs> chatlogs = CDI.current().select(ChatLogsService.class)
                .get().getChatLogsByCgidAndStageId(chatPageModel.get().getCgid(), chatPageModel.get().getActive(), true);

        //組員張貼訊息
        //group.getPostedMembers().computeIfAbsent(uid, k -> new ArrayList<>()).add(message);
        //logger.debug("PostedMembers : {}", group.getPostedMembers().size());
        eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_MEMBER_DO_SUMMARY, Optional.empty(), new ChatMessage(uid, message)));
        //如果小組此次討論越過門檻，同時是第一位進入，尚未送出AI摘要
        //TODO: 門檻未定
        if (!group.isPendingAiSummary()) {
            //將AI送出狀態改為True
            group.getPendingAiSummary().compareAndSet(false, true);
            //送出所有訊息給AI
            List<String> userPrompts = new ArrayList<>();
            userPrompts.add("**接下來的內容是這階段的對話記錄。**\n");
//            group.getPostedMembers().forEach((k, v) ->
//                    userPrompts.addAll(v)
//            );

            userPrompts.add(chatlogs.stream().map(ChatLogs::getMessage).collect(Collectors.joining("\n")));
            userPrompts.add(message);
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_PENDING_AI_SUMMARY, Optional.empty(), new ChatMessage(uid, message)));

            OpenAIResponseIDPushMessage openAIResponseIDPushMessage
                    = openAIWritingChatUpdaterService.doSendGroupAIAsyncPrompt(
                    OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(30)),
                    Optional.of(chatPageModel.get().getPreviousId()),
                    AISystemPrompts.createLLMPostMessageSystemPrompts(),
                    userPrompts, Optional.of(AIConstants.VECTOR_ID_LLM4WRITING), chatPageModel.get());
            //AI回覆訊息
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_AI_SUMMARY, chatPageModel, openAIResponseIDPushMessage));
            //清除所有對話，重新開始小組與AI的對話
            group.getPostedMembers().clear();
            group.getPendingAiResponse().compareAndSet(true, false);
            group.getPendingAiSummary().compareAndSet(true, false);
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_MEMBER_READY_GO_TO_NEXT_PHASE, chatPageModel, new ChatMessage(uid, message)));
        } else {
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_PENDING_AI_SUMMARY, Optional.empty(), new ChatMessage(uid, message)));
        }
    }


    /**
     * 請AI產生結構樹JSON
     *
     * @param group
     * @param groupId
     * @param uid
     * @param chatPageModel
     * @param genreType
     * @param eventSink
     */
    public void postTreePrompt(GroupState group, int groupId, int uid, Optional<
            ChatPageModel> chatPageModel, Optional<GenreType> genreType, Consumer<ChatEvent> eventSink) {
        logger.debug("ready to group postTreePrompt(group, {}, {}, {}, eventSink)", groupId, uid, genreType);
        if (group == null) {
            logger.debug("groupstate {} is null", group);
            group = getGroup(groupId);
        }

        eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_MEMBER_DO_TREE, Optional.empty(), new ChatMessage(uid, "")));
        //如果小組此次討論越過門檻，同時是第一位進入，尚未送出AI Tree Prompt
        //TODO: 門檻未定
        if (!group.isPendingAiTreeResponse()) {
            //將AI送出狀態改為True
            group.getPendingAiTreeResponse().compareAndSet(false, true);
            //送出所有訊息給AI
            List<String> userPrompts = new ArrayList<>();
            group.getPostedMembers().forEach((k, v) ->
                    userPrompts.addAll(v)
            );

            logger.debug("PreviousId Tree Prompt : {}", chatPageModel.get().getPreviousId());
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_PENDING_AI_TREE_JSON, Optional.empty(), new ChatMessage(uid, "")));
            try {
                OpenAITreeResponsePushMessage openAITreeResponsePushMessage
                        = openAIWritingChatUpdaterService.doSendGroupAsyncUserTreePrompt(
                        OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(120)),
                        Optional.of(chatPageModel.get().getPreviousId()),
                        genreType, Optional.of(AIConstants.VECTOR_ID_LLM4WRITING), chatPageModel.get());
                //AI回覆訊息
                eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_AI_TREE_JSON, chatPageModel, openAITreeResponsePushMessage));
                //清除所有對話，重新開始小組與AI的對話
                group.getPostedMembers().clear();
                group.getPendingAiResponse().compareAndSet(true, false);
                group.getPendingAiSummary().compareAndSet(true, false);
                group.getPendingAiTreeResponse().compareAndSet(true, false);
                eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_MEMBER_READY_GO_TO_NEXT_PHASE, chatPageModel, new ChatMessage(uid, "")));
            } catch (Exception e) {
                logger.debug(e.getMessage(), e);
                eventSink.accept(new ChatEvent(groupId, ChatEventType.CANNOT_GEN_TREE, chatPageModel, new ChatMessage(uid, "")));
            }
        } else {
            eventSink.accept(new ChatEvent(groupId, ChatEventType.GROUP_PENDING_AI_TREE_JSON, Optional.empty(), new ChatMessage(uid, "")));
        }
    }


    /**
     * 個人產生結構樹
     *
     * @param chatPageModel
     * @param genreType
     * @param eventSink
     */
    public void postPersonalTreePrompt(Optional<ChatPageModel> chatPageModel, Optional<GenreType> genreType, Consumer<ChatEvent> eventSink) {
        OpenAITreeResponsePushMessage openAITreeResponsePushMessage
                = openAIWritingChatUpdaterService.doSendGroupAsyncUserTreePrompt(
                OpenAIApiClientSingleton.INSTANCE.getOpenAIClientAsync(AIConstants.RemoteLLM4WritingFolder, executorService, Duration.ofSeconds(120)),
                Optional.of(chatPageModel.get().getPreviousId()),
                genreType, Optional.of(AIConstants.VECTOR_ID_LLM4WRITING), chatPageModel.get());
        //AI回覆訊息
        eventSink.accept(new ChatEvent(0, ChatEventType.PERSONAL_AI_TREE_JSON, chatPageModel, openAITreeResponsePushMessage));


    }
}
