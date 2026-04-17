package tw.com.slsinfo.essayai.repositories;


import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mongo.entities.ChatLogs;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stage;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagelog;

import java.util.List;

@Local
public interface IStageRepository {

    /**
     * 取得 Stage 物件
     *
     * @param id
     * @return
     */
    Stage findId(int id);

    List<Stage> findAllStages(String llmtype,  String chattype);

    /**
     * 取得 Stage 物件參考
     *
     * @param id
     * @return
     */
    Stage referenceById(int id);

    /**
     * 更新單位資料
     *
     * @param school
     * @return
     */
    Stage updateEntity(Stage stage);

    List<Integer> findbyNewStageidbycgid(int cgid);

    List<Integer> getDistinctStageIdsByCgid(int cgid);

    List<ChatLogs> getChatLogsByCgidAndStageId(int cgid, int stageId);

    List<Integer> findbyNewStageidbycgid(int cgid, int cid);

    /**
     * 階段名稱取得使用者目前階段ID
     *
     * @param stagename 階段名稱
     * @return
     */
    List<Stage> findStageByName(String stagename);

}