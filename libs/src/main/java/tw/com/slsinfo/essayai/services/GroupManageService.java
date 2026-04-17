package tw.com.slsinfo.essayai.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroup;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroupmember;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.essayai.repositories.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@ApplicationScoped
public class GroupManageService {
    @Inject
    private IClassinfoRepository iClassinfoRepository;
    @Inject
    private IClassgroupRepository iClassgroupRepository;
    @Inject
    private IClassgroupMemberRepository iClassgroupMemberRepository;
    @Inject
    private IOpenclassRepository iOpenclassRepository;

    private static final Logger logger = LogManager.getLogger(EssayService.class);

    public GroupManageService() {
    }

    public GroupManageService(IClassinfoRepository iClassinfoRepository,
                              IClassgroupRepository iClassgroupRepository,
                              IClassgroupMemberRepository iClassgroupMemberRepository,
                              IOpenclassRepository iOpenclassRepository) {

        this.iClassinfoRepository = iClassinfoRepository;
        this.iClassgroupRepository = iClassgroupRepository;
        this.iClassgroupMemberRepository = iClassgroupMemberRepository;
        this.iOpenclassRepository = iOpenclassRepository;
    }

    // 取得所有班級名稱（用於下拉選單）
    public List<String> getAllClassNames(Integer schoolId) {
        return iClassinfoRepository.findAllClassNames(schoolId);
    }

    // 根據班級名稱取得學生清單
    public List<Classinfo> getStudentsByClass(Integer schoolId, String classname) {
        if (classname == null || classname.isEmpty()) {
            return iClassinfoRepository.findBySchoolId(schoolId);
        }
        return iClassinfoRepository.findByClassname(schoolId, classname);
    }

    // 取得未分組的學生
    public List<Classinfo> getUnassignedStudents(Integer schoolId, String classname, Integer ocid) {
        List<Classinfo> allStudents = getStudentsByClass(schoolId, classname);
        List<Classgroupmember> assignedMembers = iClassgroupMemberRepository.findByOcid(ocid);
        List<Integer> assignedIds = assignedMembers.stream()
                .map(Classgroupmember::getMemberCid)
                .map(Classinfo::getId)
                .toList();

        return allStudents.stream()
                .filter(student -> !assignedIds.contains(student.getId()))
                .collect(Collectors.toList());
    }

    // 取得指定開課的所有組別
    public List<Classgroup> getGroupsByOcid(Integer ocid) {
        return iClassgroupRepository.findByOcid(ocid);
    }

    // 建立新組別
    public Classgroup createGroup(Integer ocid, String groupname) {
        Classgroup group = new Classgroup(iOpenclassRepository.referenceById(ocid), groupname);
        group.setCreated(Instant.now());
        group.setModified(Instant.now());
        iClassgroupRepository.save(group);
        return group;
    }

    // 刪除組別
    public void deleteGroup(Integer groupId) {
        Classgroup group = iClassgroupRepository.findById(groupId);
        if (group != null) {
            iClassgroupRepository.delete(group);
        }
    }

    // 載入現有分組資料
    public void loadExistingGroups(Integer ocid) {
        List<Classgroup> groups = iClassgroupRepository.findByOcid(ocid);
        // 資料已經透過 JPA 關聯自動載入
    }

    // 儲存所有分組
    public void saveAllGroups(Integer ocid, List<Classgroup> groups) {
        for (Classgroup group : groups) {
            if (group.getId() == null) {
                iClassgroupRepository.save(group);
            }
        }
    }

    @Transactional
    public int batchAssignStudentsToGroups(Map<Integer, Integer> assignments, Integer ocid) throws Exception {
        int processedCount = 0;
//        logger.debug("開始批次處理 {} 個分組分配", assignments.size());

        if (assignments == null || assignments.isEmpty()) {
            logger.warn("沒有提供批次分配資料");
            return 0;
        }

        try {
            for (Map.Entry<Integer, Integer> entry : assignments.entrySet()) {
                Integer studentId = entry.getKey();
                Integer groupId = entry.getValue();

                try {
                    // 使用現有的方法進行分配
                    assignStudentToGroup(studentId, groupId, ocid);
                    processedCount++;
                    logger.debug("成功處理學生 {} 的分組分配 -> 組別 {}", studentId, groupId);

                } catch (Exception e) {
                    logger.debug("處理學生 {} 分組時發生錯誤: {}", studentId, e.getMessage(), e);
                    // 繼續處理其他學生，但記錄錯誤
                    // 可以考慮是否要拋出異常中斷整個批次
                }
            }

//            logger.debug("批次處理完成，成功處理 {} 個分配", processedCount);

        } catch (Exception e) {
            logger.debug("批次處理過程中發生嚴重錯誤", e);
            throw e;
        }

        return processedCount;
    }

    // 修正您現有的 assignStudentToGroup 方法
    public void assignStudentToGroup(Integer studentId, Integer groupId, Integer ocid) {
        try {
            logger.debug("分配學生 {} 到組別 {} (課程 {})", studentId, groupId, ocid);

            // 先移除該學生在此課程中的現有分組
            iClassgroupMemberRepository.deleteByMemberCid(studentId, ocid);

            // 如果指定了新組別，則加入新組別
            if (groupId != null) {
                // 驗證組別是否存在且屬於正確的課程
                Classgroup classgroup = iClassgroupRepository.findById(groupId);
                if (classgroup == null) {
                    throw new RuntimeException("組別不存在: " + groupId);
                }

                // 驗證組別是否屬於指定課程
                if (!classgroup.getOcid().getId().equals(ocid)) {
                    throw new RuntimeException("組別 " + groupId + " 不屬於課程 " + ocid);
                }

                Classinfo classinfo = iClassinfoRepository.findId(studentId);
                if (classinfo == null) {
                    throw new RuntimeException("學生不存在: " + studentId);
                }

                // 建立新的分組成員記錄
                Classgroupmember member = new Classgroupmember(classgroup, classinfo);
                iClassgroupMemberRepository.save(member);

                logger.debug("成功分配學生 {} 到組別 {}", studentId, groupId);
            } else {
                logger.debug("學生 {} 被移至未分配狀態", studentId);
            }

        } catch (Exception e) {
            logger.debug("分配學生 {} 到組別 {} 時發生錯誤", studentId, groupId, e);
            throw new RuntimeException("分配學生失敗: " + e.getMessage(), e);
        }
    }

    // 添加驗證方法
    public boolean validateBatchAssignments(Map<Integer, Integer> assignments, Integer ocid) {
        if (assignments == null || assignments.isEmpty()) {
            return false;
        }

        for (Map.Entry<Integer, Integer> entry : assignments.entrySet()) {
            try {
                Integer studentId = entry.getKey();
                Integer groupId = entry.getValue();

                // 檢查學生是否存在
                if (iClassinfoRepository.getClassinfoById(studentId) == null) {
                    logger.debug("學生不存在 - studentId: {}", studentId);
                    return false;
                }

                // 檢查組別是否存在（允許null，表示移到未分配）
                if (groupId != null) {
                    Classgroup group = iClassgroupRepository.findById(groupId);
                    if (group == null) {
                        logger.debug("組別不存在 - groupId: {}", groupId);
                        return false;
                    }

                    // 檢查組別是否屬於正確的課程
                    if (!group.getOcid().getId().equals(ocid)) {
                        logger.debug("組別 {} 不屬於課程 {}", groupId, ocid);
                        return false;
                    }
                }

            } catch (Exception e) {
                logger.debug("驗證分配資料時發生錯誤 - studentId: {}, groupId: {}", entry.getKey(), entry.getValue(), e);
                return false;
            }
        }

        return true;
    }

    /**
     * 檢查是否支援批次處理
     */
    public boolean supportsBatchProcessing() {
        return true;
    }

    /**
     * 清除學生在指定課程中的所有分組
     */
    private void clearStudentGroupAssignment(Integer studentId, Integer ocid) throws Exception {
        logger.debug("清除學生 {} 在課程 {} 中的分組", studentId, ocid);

        try {
//            // 查找該學生在此課程中的所有分組成員記錄
//            List<Classgroupmember> existingMembers = iClassgroupMemberRepository.findByMemberCid(studentId);

            // 刪除分組成員記錄
            iClassgroupMemberRepository.deleteByMemberCid(studentId, ocid);
            logger.debug("已移除學生 {} 從組別 {} 的成員關係", studentId, ocid);

        } catch (Exception e) {
            logger.debug("清除學生分組時發生錯誤: {}", e.getMessage());
            throw e;
        }
    }

    // GroupManageService.java

    /**
     * 設定組長
     * @param groupId 組別ID
     * @param studentId 要設為組長的學生ID
     */
    @Transactional
    public void setCaptain(Integer groupId, Integer studentId) {
        try {
            iClassgroupMemberRepository.setCaptain(groupId, studentId);
        } catch (Exception e) {
            logger.debug("設定組長失敗", e);
            throw new RuntimeException("設定組長失敗: " + e.getMessage());
        }
    }

    /**
     * 取消組長
     * @param groupId 組別ID
     * @param studentId 學生ID
     */
    @Transactional
    public void removeCaptain(Integer groupId, Integer studentId) {
        try {
            iClassgroupMemberRepository.removeCaptain(groupId, studentId);
        } catch (Exception e) {
            logger.debug("取消組長失敗", e);
            throw new RuntimeException("取消組長失敗: " + e.getMessage());
        }
    }
}
