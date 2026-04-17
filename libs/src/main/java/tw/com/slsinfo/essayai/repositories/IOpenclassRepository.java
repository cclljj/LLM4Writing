package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.validation.constraints.NotNull;
import tw.com.slsinfo.essayai.databases.mysql.entities.Openclass;
import tw.com.slsinfo.essayai.models.course.OpenClassModel;
import tw.com.slsinfo.essayai.models.course.OpenClassesView;

import java.util.List;
import java.util.Optional;

/**
 * 小組管理
 */
@Local
public interface IOpenclassRepository {


    /**
     * 取的 Openclass 物件
     *
     * @param id
     * @return
     */
    Openclass findId(int id);


    /**
     * 取的 Openclass 物件
     *
     * @param id
     * @return
     */
    Openclass referenceById(int id);

    /**
     * 更新資料
     *
     * @param openclass
     * @return
     */
    Openclass updateEntity(Openclass openclass);

    /**
     * 建置 Openclass
     *
     * @param openclass
     */
    void createOpenclass(Openclass openclass);

    /**
     * 查詢開課
     *
     * @param classname 班級名稱
     * @param eid       作文編號
     * @return
     */
    List<Openclass> getOpenClassFilter(Integer id, String enable, String classname, Integer eid, String llmtype);

    List<Openclass> getOpenClassFilter(Integer sid, Integer uid, String enable, String llmtype);


    Openclass getOpenClassOne(int openclass_id);

    void deleteOpenclass(@NotNull int id);

    /**
     * 儲存開課資訊
     *
     * @param openclass 開課實體
     * @return 已儲存的開課實體
     */
    Openclass save(Openclass openclass);

    /**
     * 刪除開課資訊
     *
     * @param openclass 開課實體
     */
    void delete(Openclass openclass);

    /**
     * 查詢所有啟用的開課
     *
     * @return 開課列表
     */
    List<Openclass> findAllEnabled();
}
