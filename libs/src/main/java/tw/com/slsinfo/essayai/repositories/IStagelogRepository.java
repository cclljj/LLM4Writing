package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagelog;

import java.util.List;

/**
 * 學生活動進行日誌
 */
@Local
public interface IStagelogRepository {

    /**
     * 取得 Stagelog 物件
     *
     * @param id
     * @return
     */
    Stagelog findId(int id);


    /**
     * 取得 Stagelog 物件參考
     *
     * @param id
     * @return
     */
    Stagelog referenceById(int id);

    /**
     * 更新單位資料
     *
     * @param stagelog
     * @return
     */
    Stagelog updateEntity(Stagelog stagelog);

    /**
     * 以年班ID（目前一位使用者只有一個年班）及開課小組ID取得使用者目前活動進度
     *
     * @param cid  classinfo id
     * @param cgid classgroups id
     * @return
     */
    List<Stagelog> findCurrentStagelog(Integer cid, Integer cgid);

    /**
     * 找到同組別中最大的stageid
     *
     * @param cgid
     * @param chattype
     * @return
     */
    List<Stagelog> findNewStagelog(Integer cgid, String chattype);

    /**
     * 找到同班級寫作主題中最大的stageid
     *
     * @param ocid
     * @return
     */
    Integer findNewStagelogIdInOpenClass(Integer ocid);

    /**
     * 儲存 stagelog 記錄
     */
    void save(Stagelog stagelog);

    boolean existsDuplicateStagelog(String responseid, String messageid,
                                    Integer stageId, Integer cgid,
                                    Integer ocid, Integer cid, String isend);
}
