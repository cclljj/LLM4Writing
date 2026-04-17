package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroup;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroupmember;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.essayai.models.course.ClassinfoViewModel;

import java.util.List;

/**
 * 管理
 */
@Local
public interface IClassgroupMemberRepository {


    /**
     * 取的 Classinfo 物件
     *
     * @param id
     * @return
     */
    Classgroupmember findId(int id);


    /**
     * 取的 Classinfo 物件
     *
     * @param id
     * @return
     */
    Classgroupmember referenceById(int id);

    /**
     * 以使用者UID尋找分組
     *
     * @param uid
     * @return
     */
    List<Classgroupmember> findByUid(User uid);

    /**
     * 更新資料
     *
     * @param classinfo
     * @return
     */
    Classgroupmember updateEntity(Classgroupmember classinfo);

    /**
     * 查詢單位
     *
     * @param cgid
     * @return
     */
    List<ClassinfoViewModel> getClassgroupmembercidFilter(Integer cgid);

    /**
     * 根據分組ID查詢所有成員
     *
     * @param cgid 分組ID
     * @return 分組成員列表
     */
    List<Classgroupmember> findByCgid(Integer cgid);

    /**
     * 根據成員CID查詢分組成員記錄
     *
     * @param memberCid 成員CID
     * @return 分組成員列表
     */
    List<Classgroupmember> findByMemberCid(Integer memberCid);

    /**
     * 儲存分組成員
     *
     * @param classgroupmember 分組成員實體
     * @return 已儲存的分組成員實體
     */
    Classgroupmember save(Classgroupmember classgroupmember);

    /**
     * 刪除分組成員
     *
     * @param classgroupmember 分組成員實體
     */
    void delete(Classgroupmember classgroupmember);

    /**
     * 根據分組ID刪除所有成員
     *
     * @param cgid 分組ID
     */
    void deleteByCgid(Integer cgid);

    /**
     * 根據開課編號刪除所有相關成員
     *
     * @param ocid 開課編號
     */
    void deleteByOcid(Integer ocid);

    /**
     * 批次儲存分組成員
     *
     * @param members 分組成員列表
     * @return 已儲存的分組成員列表
     */
    List<Classgroupmember> saveAll(List<Classgroupmember> members);

    List<Classgroupmember> findByOcid(Integer ocid);
    Classgroupmember findByMemberCid(Integer memberCid, Integer ocid);
    void deleteByMemberCid(Integer memberCid, Integer ocid);
    boolean existsByMemberCidAndCgid(Integer studentId, Integer groupId);
    void setCaptain(Integer groupId, Integer studentId);
    void removeCaptain(Integer groupId, Integer studentId);
}
