package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;

import java.util.List;

/**
 * 單位(學校) 管理
 */
@Local
public interface ISchoolRepository {


    /**
     * 取的 School 物件
     *
     * @param id
     * @return
     */
    School findId(int id);


    /**
     * 取的 School 物件
     *
     * @param id
     * @return
     */
    School referenceById(int id);

    /**
     * 更新單位資料
     *
     * @param school
     * @return
     */
    School updateEntity(School school);

    /**
     * 查詢單位
     *
     * @param schoolname 學校名稱
     * @param sid        學校代碼
     * @return
     */
    List<School> getSchoolFilter(String enable, String schoolname, String sid);

    /**
     * 以SchoolId查詢單位
     *
     * @param schoolid
     * @return
     */
    List<School> getSchoolBySchoolId(String schoolid);

}
