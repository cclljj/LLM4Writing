package tw.com.slsinfo.essayai.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.io.DTUtils;
import tw.com.slsinfo.essayai.chatroom.ChatEventType;
import tw.com.slsinfo.essayai.databases.mongo.entities.ChatLogs;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.essayai.repositories.IChatLogsRepository;
import tw.com.slsinfo.essayai.repositories.IStageRepository;

import java.util.List;

@ApplicationScoped
public class ChatLogsService {
    private static final Logger LOGGER = LoggerFactory.getLogger(ChatLogsService.class);
    @Inject
    private IChatLogsRepository chatLogsRepository;
    @Inject
    private IStageRepository stageRepository;

    /**
     * 寫入對話記錄
     *
     * @param chatLogs
     */
    public void addChatLogs(ChatLogs chatLogs) {
        chatLogsRepository.save(chatLogs);
    }

    /**
     * 寫入對話記錄
     *
     * @param chatPageModel
     * @param message
     * @param eventType
     */
    public void addChatLogs(ChatPageModel chatPageModel, String message, EventType eventType) {
        ChatLogs chatLogs = new ChatLogs();
        chatLogs.setUid(chatPageModel.getAccount());
        chatLogs.setUserid(chatPageModel.getUserid());
        chatLogs.setTruename(chatPageModel.getTruename());
        chatLogs.setMessage(message);
        chatLogs.setEventType(eventType);
        chatLogs.setStageid(chatPageModel.getActive());
        chatLogs.setResponseid(chatLogs.getResponseid());
        chatLogs.setCid(chatPageModel.getMembercid());
        chatLogs.setCgid(chatPageModel.getCgid());
        chatLogs.setOcid(chatPageModel.getOcid());
        chatLogs.setTimestamp(DTUtils.getISODateTime());
        chatLogsRepository.save(chatLogs);
    }

    /**
     * 寫入對話記錄及小組AI對話事件
     *
     * @param chatPageModel
     * @param message
     * @param eventType
     * @param chatEventType
     */
    public void addChatLogs(ChatPageModel chatPageModel, String message, EventType eventType, ChatEventType chatEventType) {
        ChatLogs chatLogs = new ChatLogs();
        chatLogs.setUid(chatPageModel.getAccount());
        chatLogs.setUserid(chatPageModel.getUserid());
        chatLogs.setTruename(chatPageModel.getTruename());
        chatLogs.setMessage(message);
        chatLogs.setEventType(eventType);
        chatLogs.setChatEventType(chatEventType);
        chatLogs.setStageid(chatPageModel.getActive());
        chatLogs.setResponseid(chatLogs.getResponseid());
        chatLogs.setCid(chatPageModel.getMembercid());
        chatLogs.setCgid(chatPageModel.getCgid());
        chatLogs.setOcid(chatPageModel.getOcid());
        chatLogs.setTimestamp(DTUtils.getISODateTime());
        chatLogsRepository.save(chatLogs);
    }

    /**
     * 取得某使用者的對話記錄
     *
     * @param uid
     * @return
     */
    public List<ChatLogs> getChatLogs(String uid) {
        return chatLogsRepository.find(uid);
    }

    /**
     * 取得某使用者的等定事件對話記錄
     *
     * @param uid
     * @param eventType
     * @return
     */
    public List<ChatLogs> getChatLogs(String uid, EventType eventType) {
        return chatLogsRepository.find(uid, eventType);
    }

    public List<ChatLogs> getChatLogsbycgid(int cgid) {
        return chatLogsRepository.findbycgid(cgid);
    }

    public List<ChatLogs> getChatPersonalLogsbycgid(int cgid, int cid) {
        return chatLogsRepository.findbycgid(cgid, cid);
    }

    public List<Integer> getDistinctStageIdsByCgid(int cgid) {
        return stageRepository.getDistinctStageIdsByCgid(cgid);
    }

    /**
     * 根據 cgid 和 stageid 查詢對話記錄
     */
    public List<ChatLogs> getChatLogsByCgidAndStageId(int cgid, int stageId, boolean isall) {
        return chatLogsRepository.findbycgidstageid(cgid, stageId, isall);
    }

    public List<ChatLogs> getChatLogsByCgidAndStageId(int cgid, int cid, int stageId, boolean isall) {
        return chatLogsRepository.findbycgidstageid(cgid, cid, stageId, isall);
    }
}
