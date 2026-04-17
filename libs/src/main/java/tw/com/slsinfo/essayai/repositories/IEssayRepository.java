package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essay;
import tw.com.slsinfo.essayai.databases.mysql.entities.Genre;
import tw.com.slsinfo.essayai.databases.mysql.entities.Openclass;

import java.util.List;

/**
 * 單位(學校) 管理
 */
@Local
public interface IEssayRepository {


    /**
     * 取的 Essay 物件
     *
     * @param id
     * @return
     */
    Essay findId(int id);


    /**
     * 取的 Essay 物件
     *
     * @param id
     * @return
     */
    Essay referenceById(int id);

    /**
     * 更新單位資料
     *
     * @param essay
     * @return
     */
    Essay updateEntity(Essay essay);

    /**
     * 查詢單位
     *
     * @param enable      啟用狀態
     * @param essay_title 作文名稱
     * @return
     */
    List<Essay> getEssayFilter(String enable, String essay_title, Integer sid, String llmtype);

    /**
     * 以essay_id查詢單位
     *
     * @param essay_id
     * @return
     */
    Essay getEssayById(int essay_id);

    /**
     * 建置 Essay
     *
     * @param essay
     */
    void createEssay(Essay essay);

    void deleteEssay(Integer eid);
}

