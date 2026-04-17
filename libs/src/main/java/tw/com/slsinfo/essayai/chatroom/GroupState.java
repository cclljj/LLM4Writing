package tw.com.slsinfo.essayai.chatroom;

import org.apache.wicket.protocol.ws.api.registry.IKey;
import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essayquestion;
import tw.com.slsinfo.essayai.models.course.LLMStageQuestionsModel;
import tw.com.slsinfo.essayai.models.openai.OpenAIResponseIDPushMessage;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentSkipListSet;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;


/**
 * 群組狀態Payload
 */
public class GroupState extends SerializeModel {
    /**
     * 小組ID
     */
    private final int groupId;
    /**
     * 預期小組成員數
     */
    private final int expectedSize;
    /**
     * 允許多少小組成員加入後即可進入小組討論區
     */
    private final int minQuorum;
    /**
     * 允許多少時間之後自動進入會議室
     */
    private final Instant joinDeadline;
    /**
     * 每輪小組最小發言數量
     */
    private final int minGroupMessagesPerTurn;
    /**
     * 前次小組與AI對話的ID
     */
    private final AtomicReference<String> previousMessageId = new AtomicReference<>();
    /**
     * 目前是否正在執行AI呼叫，也就是等待AI回覆中
     */
    private final AtomicBoolean pendingAiResponse = new AtomicBoolean(false);
    /**
     * 目前是否正在進行AI摘要
     */
    private final AtomicBoolean pendingAiSummary = new AtomicBoolean(false);
    /**
     * 目前是否正在進行AI產生結
     */
    private final AtomicBoolean pendingAiTreeResponse = new AtomicBoolean(false);
    /**
     * 是否為此次活動的第一次AI回覆，因為首次AI回覆只能有一次
     */
    private final AtomicReference<OpenAIResponseIDPushMessage> openAIResponseIDPushMessageAtomicReference = new AtomicReference<>();

    /**
     * 小組成員
     */
    private final Set<GroupMember> groupMembers = ConcurrentHashMap.newKeySet();
    /**
     * 小組活動階段組員
     */
    private final Set<GroupMember> phaseGroupMembers = ConcurrentHashMap.newKeySet();
    /**
     * 已發言的組員，一位組員可以發言N次
     */
    private final Map<Integer, List<String>> postedMembers = new ConcurrentHashMap<>();
    /**
     * 目前小組所在頁面，用來判定同小組成員是否可接收到訊息
     */
    private final AtomicReference<IKey> currentPageIKey = new AtomicReference<>();
    /**
     * 小組討論是否已開始
     */
    private final AtomicBoolean started = new AtomicBoolean(false);
    /**
     * 目前加入加入討論成員數量，用來計算是否可以請AI回覆訊息
     */
    private final AtomicInteger currentMembers = new AtomicInteger(0);
    /**
     * 目前對話輪迴
     */
    private final AtomicInteger chatturns = new AtomicInteger(0);

    /**
     * 小組階段問題庫
     */
    private final AbstractSet<LLMStageQuestionsModel> llmquestionset = new ConcurrentSkipListSet<>(Comparator.comparingInt(LLMStageQuestionsModel::getStepSort).thenComparing(LLMStageQuestionsModel::getQuestionId));

    /**
     *
     * @param groupId      group id
     * @param expectedSize 預期小組成員數，可從DB查詢得來
     * @param minQuorum    最小可進入聊天室數組員數
     * @param joinWindow   N分鐘後自動進入會議室
     */
    public GroupState(int groupId, int expectedSize, int minQuorum, Duration joinWindow) {
        this.expectedSize = expectedSize;
        this.groupId = groupId;
        this.minQuorum = minQuorum;
        this.joinDeadline = Instant.now().plus(joinWindow);
        this.minGroupMessagesPerTurn = expectedSize;
    }

    /**
     * 預設3分鐘後自動進入聊天室
     *
     * @param groupId      group id
     * @param expectedSize 預期小組成員數，可從DB查詢得來
     * @param minQuorum    最小可進入聊天室數組員數
     */
    public GroupState(int groupId, int expectedSize, int minQuorum) {
        this.expectedSize = expectedSize;
        this.groupId = groupId;
        this.minQuorum = minQuorum;
        this.joinDeadline = Instant.now().plus(Duration.ofMinutes(3));
        this.minGroupMessagesPerTurn = expectedSize;
    }

    /**
     * 預設以3人為小組，並且2人以上就可自動進入聊天室
     *
     * @param groupId    group id
     * @param joinWindow N分鐘後自動進入會議室
     */
    public GroupState(int groupId, Duration joinWindow) {
        this.groupId = groupId;
        this.joinDeadline = Instant.now().plus(joinWindow);
        this.expectedSize = 3;
        this.minGroupMessagesPerTurn = expectedSize;
        this.minQuorum = 1 + (expectedSize / 2);
    }

    /**
     * 預設以小組人數一半 以上就可自動進入聊天室
     *
     * @param groupId
     * @param expectedSize
     * @param joinWindow
     */
    public GroupState(int groupId, int expectedSize, Duration joinWindow) {
        this.groupId = groupId;
        this.joinDeadline = Instant.now().plus(joinWindow);
        this.expectedSize = expectedSize;
        this.minQuorum = (int) Math.ceil(0.35d * expectedSize);
        this.minGroupMessagesPerTurn = expectedSize;
    }

    /**
     * 小組共用同一個MessageIDs
     *
     * @param generator
     * @return
     */
    public String getOrCreateShareGroupMessageId(Supplier<String> generator) {
        String k = previousMessageId.get();
        if (k != null) return k;
        String newKey = generator.get();
        if (previousMessageId.compareAndSet(null, newKey)) {
            return newKey;
        }
        return previousMessageId.get(); // someone else won the race
    }

    /**
     * 小組活動第一個AI回覆訊息
     *
     * @param generator
     * @return
     */
    public OpenAIResponseIDPushMessage getOrCreateOpenAIResponseIDPushMessage(Supplier<OpenAIResponseIDPushMessage> generator) {
        OpenAIResponseIDPushMessage msg = openAIResponseIDPushMessageAtomicReference.get();
        if (msg != null) return msg;
        OpenAIResponseIDPushMessage newMessage = generator.get();
        if (openAIResponseIDPushMessageAtomicReference.compareAndSet(null, newMessage)) {
            return newMessage;
        }
        return openAIResponseIDPushMessageAtomicReference.get();
    }

    /**
     * 指定小組活動第一個AI回覆訊息
     *
     * @param openAIResponseIDPushMessage
     */
    public void setOpenAIResponseIDPushMessage(OpenAIResponseIDPushMessage openAIResponseIDPushMessage) {
        openAIResponseIDPushMessageAtomicReference.set(openAIResponseIDPushMessage);
    }

    /**
     * clear reference
     */
    public void clearOpenAIResponseIDPushMessage() {
        openAIResponseIDPushMessageAtomicReference.set(null);
    }

    public Map<Integer, List<String>> getPostedMembers() {
        return postedMembers;
    }

    /**
     * 取得LLM問題庫
     *
     * @return
     */
    public Set<LLMStageQuestionsModel> getLlmquestionset() {
        return llmquestionset;
    }

    /**
     * 寫入本階段LLM問題庫
     *
     * @param llmquestionset
     */
    public void setLlmquestionset(Set<LLMStageQuestionsModel> llmquestionset) {
        this.llmquestionset.clear();
        this.llmquestionset.addAll(llmquestionset);
    }

    /**
     * 小組是否己有與AI對話記錄
     *
     * @return
     */
    public boolean hasShareGroupMessageId() {
        return previousMessageId.get() != null;
    }

    /**
     * 取得小組與AI對話ID
     *
     * @return
     */
    public String getShareGroupMessageId() {
        return previousMessageId.get();
    }

    /**
     * 取得第一次AI回覆內容
     *
     * @return
     */
    public OpenAIResponseIDPushMessage getOpenAIResponseIDPushMessage() {
        return openAIResponseIDPushMessageAtomicReference.get();
    }

    /**
     * 是否有第一次AI回覆內容
     *
     * @return
     */
    public boolean hasOpenAIResponseIDPushMessage() {
        return openAIResponseIDPushMessageAtomicReference.get() != null;
    }

    /**
     * 小組討論是否開始
     *
     * @return
     */
    public boolean hasStarted() {
        return started.get();
    }

    /**
     * 設定小組討論開始
     *
     * @return
     */
    public boolean markStarted() {
        return started.compareAndSet(false, true);
    }

    /**
     * 是否全員到齊
     *
     * @return
     */
    public boolean allMembersPresent() {
        return groupMembers.size() >= expectedSize;
    }

    /**
     * 是否到達最小進入聊天室人數
     *
     * @return
     */
    public boolean quorumReached() {
        return groupMembers.size() >= minQuorum;
    }

    /**
     * 是否到達自動進入聊天室時間
     *
     * @return
     */
    public boolean joinWindowExpired() {
        return Instant.now().isAfter(joinDeadline);
    }

    /**
     * 所有人都張貼訊息了
     *
     * @return
     */
    public boolean allMemberPostMessage() {
        return postedMembers.size() >= expectedSize;
    }

    /**
     * 最小人數張貼訊息了
     *
     * @return
     */
    public boolean quorumMemberPostMessage() {
        return postedMembers.size() >= minQuorum;
    }

    /**
     * 目前已發言人數
     *
     * @return
     */
    public int postMessageMembersCount() {
        return postedMembers.size();
    }

    /**
     * 群組最小訊息數量，到達後才可以送出AI回覆
     *
     * @return
     */
    public boolean minGroupMessagesTouched() {
        return groupMessagesCollectedCount() >= minGroupMessagesPerTurn;
    }

    /**
     * 目前已蒐集的對話數量
     *
     * @return
     */
    public int groupMessagesCollectedCount() {
        AtomicInteger counter = new AtomicInteger(0);
        postedMembers.forEach((k, v) ->
                counter.set(counter.get() + v.size())
        );
        return counter.get();
    }

    /**
     * 是否呼叫AI FLAG
     *
     * @return
     */
    public AtomicBoolean getPendingAiResponse() {
        return pendingAiResponse;
    }

    /**
     * 是否AI摘要 FLAG
     *
     * @return
     */
    public AtomicBoolean getPendingAiSummary() {
        return pendingAiSummary;
    }

    /**
     * 是否AI Tree Response FLAG
     *
     * @return
     */
    public AtomicBoolean getPendingAiTreeResponse() {
        return pendingAiTreeResponse;
    }

    /**
     * 取得目前對話turn數
     *
     * @return
     */
    public AtomicInteger getChatturns() {
        return chatturns;
    }

    /**
     * 重設對話輸次
     */
    public void initChatturns() {
        chatturns.set(0);
    }

    public int getMinGroupMessagesPerTurn() {
        return minGroupMessagesPerTurn;
    }

    /**
     * 目前群組是否在等待AI Tree Response中
     *
     * @return
     */
    public boolean isPendingAiTreeResponse() {
        return pendingAiTreeResponse.get();
    }

    /**
     * 目前群組是否在等待AI回應中
     *
     * @return
     */
    public boolean isPendingAiResponse() {
        return pendingAiResponse.get();
    }

    /**
     * 目前群組是否在等待AI摘要中
     *
     * @return
     */
    public boolean isPendingAiSummary() {
        return pendingAiSummary.get();
    }

    /**
     * N人以上均張貼訊息了
     *
     * @return
     */
    public boolean quorumMessagesCollected() {
        return postedMembers.size() >= minQuorum;
    }

    public AtomicInteger getCurrentMembers() {
        return currentMembers;
    }

    public int getExpectedSize() {
        return expectedSize;
    }

    public int getGroupId() {
        return groupId;
    }

    public Set<GroupMember> getGroupMembers() {
        return groupMembers;
    }

    public Set<GroupMember> getPhaseGroupMembers() {
        return phaseGroupMembers;
    }

    public Instant getJoinDeadline() {
        return joinDeadline;
    }

    public int getMinQuorum() {
        return minQuorum;
    }


    public AtomicBoolean getStarted() {
        return started;
    }

    public void setCurrentPageIKey(IKey iKey) {
        currentPageIKey.set(iKey);
    }

    public AtomicReference<IKey> getCurrentPageIKey() {
        return currentPageIKey;
    }

    public void setPreviousMessageId(String messageId) {
        previousMessageId.set(messageId);
    }

    public AtomicReference<String> getPreviousMessageId() {
        return previousMessageId;
    }

}
