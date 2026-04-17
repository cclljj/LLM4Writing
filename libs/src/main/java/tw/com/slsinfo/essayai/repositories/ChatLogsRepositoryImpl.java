package tw.com.slsinfo.essayai.repositories;

import com.mongodb.client.model.Filters;
import com.mongodb.client.model.Sorts;
import com.mongodb.client.result.InsertOneResult;
import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.bson.conversions.Bson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IMongoCrudService;
import tw.com.slsinfo.essayai.chatroom.ChatEventType;
import tw.com.slsinfo.essayai.databases.mongo.entities.ChatLogs;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;

import java.util.ArrayList;
import java.util.List;

import static com.mongodb.client.model.Filters.*;

@Stateless
@Local(IChatLogsRepository.class)
public class ChatLogsRepositoryImpl implements IChatLogsRepository {

    private static final Logger logger = LoggerFactory.getLogger(ChatLogsRepositoryImpl.class);
    @Inject
    private IMongoCrudService<ChatLogs> chatLogsService;

    /**
     * {@inheritDoc}
     *
     * @param uid
     * @return
     */
    @Override
    public List<ChatLogs> find(String uid) {
        List<ChatLogs> list = new ArrayList<>();
        Bson filter = eq("uid", uid);
        chatLogsService.find(ChatLogs.class, filter).into(list);
//        logger.debug("{} ChatLogs size : {}", uid, list.size());
        return list;

    }

    /**
     * {@inheritDoc}
     *
     * @param uid
     * @param eventType
     * @return
     */
    @Override
    public List<ChatLogs> find(String uid, EventType eventType) {
        List<ChatLogs> list = new ArrayList<>();
        Bson filter = and(eq("uid", uid), eq("eventtype", eventType));
        chatLogsService.find(ChatLogs.class, filter).into(list);
//        logger.debug("{} ChatLogs size : {}", uid, list.size());
        return list;
    }

    /**
     * {@inheritDoc}
     *
     * @param cid
     * @param stageid
     * @param ocid
     * @param cgid
     * @return
     */
    @Override
    public List<ChatLogs> find(int cid, int stageid, int ocid, int cgid) {
        List<ChatLogs> list = new ArrayList<>();
        Bson filter = and(eq("cid", cid)
                , eq("stageid", stageid), eq("ocid", ocid), eq("cgid", cgid));
        chatLogsService.find(ChatLogs.class, filter).into(list);
        return list;
    }

    @Override
    public List<ChatLogs> findbycgid(int cgid) {
        List<ChatLogs> list = new ArrayList<>();

        // 步驟1：以 _id 降序排序，取得最後一筆（最新的）
        Bson filter = eq("cgid", cgid);
        Bson sort = Sorts.descending("timestamp");

        ChatLogs latestLog = chatLogsService.find(ChatLogs.class, filter)
                .sort(sort)
                .first();

        // 步驟2：取得該筆的 stageid，然後查詢所有相同 stageid 的記錄
        if (latestLog != null) {
            int targetStageId = latestLog.getStageid();
            Bson finalFilter = and(
                    eq("cgid", cgid),
                    eq("stageid", targetStageId),
                    ne("eventType", EventType.SYSTEM_PROMPTS)
            );
            chatLogsService.find(ChatLogs.class, finalFilter).into(list);
        }

        return list;
    }

    @Override
    public List<ChatLogs> findbycgidstageid(int cgid, int stageid, boolean isall) {
        List<ChatLogs> list = new ArrayList<>();
        int targetStageId = stageid;

        Bson finalFilter = and(
                eq("cgid", cgid),
                eq("stageid", targetStageId),
                in("eventType",
                        EventType.USER_PROMPT,
                        EventType.USER_AUDIO_PROMPT,
                        EventType.USER_AUDIO_TRANSCRIPT,
                        EventType.USER_SUMMARY_PROMPT,
                        EventType.USER_CLICK_SUMMARY,
                        EventType.USER_CONTINUE_PROMPT,
                        EventType.POST,
                        EventType.SYSTEM_PROMPTS,
                        EventType.GOT_AI_RESPONSE,
                        EventType.CLIENT_GOT_AI_RESPONSE,
                        EventType.LLM_RESPONSE,
                        EventType.GOT_AI_TREE_RESPONSE,
                        EventType.SET_ARTICLE_JUDGE_PROMPT
                )
        );

        if(!isall)
        {
            finalFilter = and(
                    finalFilter,
                    eq("chatEventType", ChatEventType.GROUP_AI_SUMMARY)
            );
        }

        chatLogsService.find(ChatLogs.class, finalFilter).into(list);
        return list;
    }

    @Override
    public List<ChatLogs> findforsummary(int cgid, int cid, int stageid, boolean isall) {
        List<ChatLogs> list = new ArrayList<>();
        int targetStageId = stageid;
        Bson finalFilter = and(
                eq("cgid", cgid),
                eq("stageid", targetStageId),
                eq("cid", cid),
                ne("eventType", EventType.SYSTEM_PROMPTS)
        );

        if (!isall) {
            finalFilter = and(
                    finalFilter,
                    eq("chatEventType", ChatEventType.GROUP_AI_SUMMARY)
            );
        }

        chatLogsService.find(ChatLogs.class, finalFilter).into(list);
        return list;
    }

    @Override
    public List<ChatLogs> findbycgidstageid(int cgid, int cid, int stageid, boolean isall) {
        List<ChatLogs> list = new ArrayList<>();
        int targetStageId = stageid;
        Bson finalFilter = and(
                eq("cgid", cgid),
                eq("stageid", targetStageId),
                eq("cid", cid),
                ne("eventType", EventType.SYSTEM_PROMPTS)
        );
        if (!isall) {
            finalFilter = and(
                    finalFilter,
                    eq("chatEventType", ChatEventType.PERSONAL_AI_SUMMARY)
            );
        }
        chatLogsService.find(ChatLogs.class, finalFilter).into(list);
        return list;
    }

    @Override
    public List<ChatLogs> findbycgid(int cgid, int cid) {
        List<ChatLogs> list = new ArrayList<>();

        Bson filter = and(eq("cgid", cgid), eq("cid", cid));
        Bson sort = Sorts.descending("timestamp");

        ChatLogs latestLog = chatLogsService.find(ChatLogs.class, filter)
                .sort(sort)
                .first();

        // 步驟2：取得該筆的 stageid，然後查詢所有相同 stageid 的記錄
        if (latestLog != null) {
            int targetStageId = latestLog.getStageid();
            Bson finalFilter = and(
                    eq("cgid", cgid),
                    eq("cid", cid),
                    eq("stageid", targetStageId),
                    ne("eventType", EventType.SYSTEM_PROMPTS)
            );

            chatLogsService.find(ChatLogs.class, finalFilter).into(list);
        }

        return list;
    }

    /**
     * {@inheritDoc}
     *
     * @param cid
     * @param stageid
     * @param ocid
     * @param cgid
     * @param eventType
     * @return
     */
    @Override
    public List<ChatLogs> find(int cid, int stageid, int ocid, int cgid, EventType eventType) {
        List<ChatLogs> list = new ArrayList<>();
        Bson filter = and(eq("cid", cid)
                , eq("stageid", stageid), eq("ocid", ocid), eq("cgid", cgid),
                eq("eventtype", eventType));
        chatLogsService.find(ChatLogs.class, filter).into(list);
        return list;
    }

    @Override
    public void save(ChatLogs chatLogs) {
        InsertOneResult insertOneResult = chatLogsService.insertOne(ChatLogs.class, chatLogs);
        try {
//            logger.debug("{} ChatLogs inserted : {}", chatLogs.getUid(), insertOneResult.getInsertedId());
        } catch (Exception e) {
            logger.debug("{} ChatLogs insert error : {}", chatLogs.getUid(), e.getMessage());
        }

    }
}
