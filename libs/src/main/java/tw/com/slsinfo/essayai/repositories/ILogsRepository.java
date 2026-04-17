package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mongo.entities.Logs;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;

import java.util.Date;
import java.util.List;

/**
 * 日誌庫
 */
@Local
public interface ILogsRepository {

    String ACCOUNT = "contextMap.account";

    String EVENT = "contextMap.event";

    String IP = "contextMap.ip";

    String SCHOOLID = "contextMap.schoolid";


    /**
     * 查詢使用者紀錄
     *
     * @param uid
     * @return
     */
    List<Logs> getUid(String uid);

    /**
     * 查詢使用者紀錄
     *
     * @param uid  帳號
     * @param type 事件類別
     * @return
     */
    List<Logs> getUid(String uid, EventType type);

    /**
     * 查詢使用者紀錄
     *
     * @param uid   帳號
     * @param start 時間起
     * @param end   時間迄
     * @param type  事件類別
     * @return
     */
    List<Logs> getUid(String uid, Date start, Date end, EventType type);

    /**
     * 查詢使用者紀錄
     *
     * @param uid    帳號
     * @param type   事件
     * @param ip     IP位置
     * @param date   日期
     * @param school 學校代碼
     * @return
     */
    List<Logs> getLogs(String uid, EventType type, String ip, Date date, String school);


}
