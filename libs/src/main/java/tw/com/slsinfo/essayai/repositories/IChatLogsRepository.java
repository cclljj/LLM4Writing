package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mongo.entities.ChatLogs;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;

import java.util.List;


@Local
public interface IChatLogsRepository {
    /**
     * 以使用者帳號查詢對話記錄
     *
     * @param uid
     * @return
     */
    List<ChatLogs> find(String uid);

    /**
     * 查詢使用者特定事件對話記錄
     *
     * @param uid
     * @param eventType
     * @return
     */
    List<ChatLogs> find(String uid, EventType eventType);

    /**
     * 以階段記錄查詢對話記錄
     *
     * @param cid
     * @param stageid
     * @param ocid
     * @param cgid
     * @return
     */
    List<ChatLogs> find(int cid, int stageid, int ocid, int cgid);

    /**
     * 以階段記錄查詢特定事件對話記錄
     *
     * @param cid
     * @param stageid
     * @param ocid
     * @param cgid
     * @param eventType
     * @return
     */
    List<ChatLogs> find(int cid, int stageid, int ocid, int cgid, EventType eventType);

    List<ChatLogs> findbycgid(int cgid);

    List<ChatLogs> findbycgidstageid(int cgid, int stagid, boolean isall);

    List<ChatLogs> findbycgid(int cgid, int cid);

    List<ChatLogs> findforsummary(int cgid, int cid, int stagid, boolean isall);

    List<ChatLogs> findbycgidstageid(int cgid, int cid, int stagid, boolean isall);

    /**
     * 寫入對話記錄
     *
     * @param chatLogs
     */
    void save(ChatLogs chatLogs);

}
