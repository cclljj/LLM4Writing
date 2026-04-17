package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroup;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;

import java.util.List;

/**
 * 管理
 */
@Local
public interface IClassgroupRepository {


    /**
     * 取的 Classinfo 物件
     *
     * @param id
     * @return
     */
    Classgroup findId(int id);


    /**
     * 取的 Classinfo 物件
     *
     * @param id
     * @return
     */
    Classgroup referenceById(int id);

    /**
     * 更新資料
     *
     * @param classinfo
     * @return
     */
    Classgroup updateEntity(Classgroup classinfo);

    /**
     * 查詢單位
     *
     * @param ocid
     * @return
     */
    List<Classgroup> getClassgroupFilter(Integer ocid);


    void save(Classgroup classGroup);

    boolean existsByOcid(Integer ocid);

    List<Classgroup> findByOcid(Integer ocid);

    Classgroup findById(Integer id);

    void delete(Classgroup classGroup);

    boolean existsByIdAndOcid(Integer groupId, Integer ocid);
}
