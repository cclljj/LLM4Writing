// ClassGroupService.java
package tw.com.slsinfo.essayai.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import jakarta.transaction.Transactional;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroup;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroupmember;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;
import tw.com.slsinfo.essayai.models.course.ClassGroupMemberModel;
import tw.com.slsinfo.essayai.models.course.ClassGroupModel;
import tw.com.slsinfo.essayai.models.course.ClassinfoViewModel;
import tw.com.slsinfo.essayai.repositories.IClassgroupMemberRepository;
import tw.com.slsinfo.essayai.repositories.IClassgroupRepository;
import tw.com.slsinfo.essayai.repositories.IOpenclassRepository;

import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class ClassGroupService {
    private static final Logger logger = LogManager.getLogger(ClassGroupService.class);

    @Inject
    private IClassgroupRepository iClassgroupRepository;
    @Inject
    private IClassgroupMemberRepository iClassgroupMemberRepository;

    public List<ClassGroupModel> getClassGroupsByOpenClass(Integer ocid) {
        List<ClassGroupModel> results = new ArrayList<>();
        List<Classgroup> classgroups = iClassgroupRepository.getClassgroupFilter(ocid);

        classgroups.forEach(e -> {
            List<ClassinfoViewModel> members = iClassgroupMemberRepository.getClassgroupmembercidFilter(e.getId());
            results.add(ClassGroupModel.createNew(e, members));
        });
        return results;
    }

    /**
     * 取得分組成員
     */
    public List<ClassGroupMemberModel> getGroupMembers(Integer cgid) {
        try {
            List<Classgroupmember> members = iClassgroupMemberRepository.findByCgid(cgid);
            List<ClassGroupMemberModel> results = new ArrayList<>();
            members.forEach(e -> {
                results.add(ClassGroupMemberModel.createNew(e));
            });

            return results;
        } catch (Exception e) {
            logger.debug("查詢分組成員失敗，cgid: {}", cgid, e);
            return new ArrayList<>();
        }
    }

    /**
     * 批次儲存分組資料
     */
    @Transactional
    public void saveClassGroups(Integer ocid, List<ClassGroupModel> groups) {
        try {
            // 1. 刪除原有的分組資料
            deleteExistingGroups(ocid);

            // 2. 新增新的分組資料
            for (ClassGroupModel groupModel : groups) {
                // 儲存分組
//                Classgroup groupEntity = new Classgroup(ocid, groupModel.getGroupname());
//                em.persist(groupEntity);
//                em.flush(); // 確保能取得 ID

                // 儲存成員
                if (groupModel.getMembers() != null) {
                //                    for (UsersView member : groupModel.getMembers()) {
//                        Usersview memberEntity = new Classgroupmember(groupEntity, new ClassInfoModel().getUserviceByMId(member));
//                        em.persist(memberEntity);
//                    }
                }
            }

//            logger.debug("成功儲存分組資料，ocid: {}, 分組數量: {}", ocid, groups.size());
        } catch (Exception e) {
            logger.debug("儲存分組資料失敗，ocid: {}", ocid, e);
            throw new RuntimeException("儲存分組資料失敗", e);
        }
    }

    /**
     * 刪除指定開課的所有分組資料
     */
    @Transactional
    private void deleteExistingGroups(Integer ocid) {
        try {
            // 先刪除成員資料
//            Query deleteMembersQuery = em.createQuery(
//                    "DELETE FROM Classgroupmember cgm WHERE cgm.cgid IN " +
//                            "(SELECT cg.id FROM Classgroup cg WHERE cg.ocid = :ocid)");
//            deleteMembersQuery.setParameter("ocid", ocid);
//            deleteMembersQuery.executeUpdate();
//
//            // 再刪除分組資料
//            Query deleteGroupsQuery = em.createQuery("DELETE FROM Classgroup cg WHERE cg.ocid = :ocid");
//            deleteGroupsQuery.setParameter("ocid", ocid);
//            deleteGroupsQuery.executeUpdate();

        } catch (Exception e) {
            logger.debug("刪除現有分組資料失敗，ocid: {}", ocid, e);
            throw new RuntimeException("刪除現有分組資料失敗", e);
        }
    }

    /**
     * 檢查是否已有分組資料
     */
    public boolean hasExistingGroups(Integer ocid) {
        try {
            int count = iClassgroupRepository.getClassgroupFilter(ocid).size();
            return count > 0;
        } catch (Exception e) {
            logger.debug("檢查分組資料失敗，ocid: {} --{}", ocid, e);
            return false;
        }
    }
}
