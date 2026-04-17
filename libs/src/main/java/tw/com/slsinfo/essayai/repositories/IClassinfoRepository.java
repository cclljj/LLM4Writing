package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;

import java.util.List;

/**
 * 管理
 */
@Local
public interface IClassinfoRepository {


    /**
     * 取的 Classinfo 物件
     *
     * @param id
     * @return
     */
    Classinfo findId(int id);


    /**
     * 取的 Classinfo 物件
     *
     * @param id
     * @return
     */
    Classinfo referenceById(int id);

    /**
     * 更新資料
     *
     * @param classinfo
     * @return
     */
    Classinfo updateEntity(Classinfo classinfo);

    /**
     * 查詢單位
     *
     * @param sid
     * @return
     */
    List<Classinfo> getStuClassinfoFilter(Integer sid, String llmtype);

    /**
     * 以cid查詢
     *
     * @param cid
     * @return
     */
    Classinfo getClassinfoById(int cid);

    List<Classinfo> findAll();
    List<Classinfo> findBySchoolId(Integer sid);
    List<String> findAllClassNames(Integer sid);
    List<Classinfo> findByClassname(Integer sid, String classname);
    Classinfo findById(Integer id);
}
