package tw.com.slsinfo.essayai.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroupmember;
import tw.com.slsinfo.essayai.models.course.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@ApplicationScoped
public class ClassgroupmemberService {
    private static final Logger logger = LogManager.getLogger(ClassgroupmemberService.class);

    @PersistenceContext
    private EntityManager entityManager;

    public List<ClassGroupMemberModel> findDataByUid(Integer uid, String llmtype) {
        List<Classgroupmember> classgroupmembers = entityManager.createQuery(
                        "SELECT p FROM Classgroupmember p " +
                                "JOIN FETCH p.cgid " +
                                "JOIN FETCH p.memberCid " +
                                "JOIN FETCH p.cgid.ocid " +
                                "JOIN FETCH p.cgid.ocid.eid " +
                                "WHERE p.memberCid.uid.id = :uid " +
                                "AND p.cgid.ocid.llmtype = :llmtype " +
                                "ORDER BY p.id", Classgroupmember.class)
                .setParameter("uid", uid)
                .setParameter("llmtype", llmtype)
                .getResultList();

        List<ClassGroupMemberModel> result = new ArrayList<>();
        classgroupmembers.forEach(classgroupmember -> {
            result.add(convertToViewModel(classgroupmember));
        });
        return result;
    }

    /**
     * 取得學生被加入的所有寫作主題
     *
     * @param uid
     * @param llmtype
     * @return
     */
    @Transactional
    public List<STActivityModel> findActivityByUid(Integer uid, String llmtype) {
        // 第一步：載入主要資料
        List<Classgroupmember> classgroupmembers = entityManager.createQuery(
                        "SELECT DISTINCT p FROM Classgroupmember p " +
                                "JOIN FETCH p.cgid " +
                                "JOIN FETCH p.memberCid " +
                                "JOIN FETCH p.memberCid.uid " +
                                "JOIN FETCH p.cgid.ocid " +
                                "JOIN FETCH p.cgid.ocid.eid " +
                                "LEFT JOIN FETCH p.cgid.ocid.eid " +
                                "LEFT JOIN FETCH p.cgid.ocid.eid.gid " +
                                "WHERE p.memberCid.uid.id = :uid " +
                                "AND p.cgid.ocid.llmtype = :llmtype " +
                                "ORDER BY p.created desc", Classgroupmember.class)
                .setParameter("uid", uid)
                .setParameter("llmtype", llmtype)
                .getResultList();

        // 第二步：批次載入所有相關群組的成員資料
        if (!classgroupmembers.isEmpty()) {
            Set<Integer> cgids = classgroupmembers.stream()
                    .map(member -> member.getCgid().getId())
                    .collect(Collectors.toSet());

            // 批次載入所有相關群組的成員
            entityManager.createQuery(
                            "SELECT cgm FROM Classgroupmember cgm " +
                                    "JOIN FETCH cgm.memberCid " +
                                    "JOIN FETCH cgm.memberCid.uid " +
                                    "WHERE cgm.cgid.id IN :cgids", Classgroupmember.class)
                    .setParameter("cgids", cgids)
                    .getResultList();
        }

        return classgroupmembers.stream()
                .map(this::convertToActivityViewModel)
                .toList();
    }

    /**
     * 取得學生所屬特定寫作主題資訊
     *
     * @param uid
     * @param cgid
     * @param llmtype
     * @return
     */
    @Transactional
    public Optional<STActivityModel> findCurrentActivityByUid(Integer uid, Integer cgid, String llmtype) {
        // 第一步：載入主要資料
        List<Classgroupmember> classgroupmembers = entityManager.createQuery(
                        "SELECT DISTINCT p FROM Classgroupmember p " +
                                "JOIN FETCH p.cgid " +
                                "JOIN FETCH p.memberCid " +
                                "JOIN FETCH p.memberCid.uid " +
                                "JOIN FETCH p.cgid.ocid " +
                                "LEFT JOIN FETCH p.cgid.ocid.eid " +
                                "LEFT JOIN FETCH p.cgid.ocid.eid.gid " +
                                "WHERE p.memberCid.uid.id = :uid " +
                                "AND p.cgid.ocid.llmtype = :llmtype " +
                                "AND p.cgid.id = :cgid " +
                                "ORDER BY p.id", Classgroupmember.class)
                .setParameter("uid", uid)
                .setParameter("cgid", cgid)
                .setParameter("llmtype", llmtype)
                .getResultList();

        // 第二步：批次載入所有相關群組的成員資料
        if (!classgroupmembers.isEmpty()) {
            Set<Integer> cgids = classgroupmembers.stream()
                    .map(member -> member.getCgid().getId())
                    .collect(Collectors.toSet());

            // 批次載入所有相關群組的成員
            entityManager.createQuery(
                            "SELECT cgm FROM Classgroupmember cgm " +
                                    "JOIN FETCH cgm.memberCid " +
                                    "JOIN FETCH cgm.memberCid.uid " +
                                    "WHERE cgm.cgid.id IN :cgids", Classgroupmember.class)
                    .setParameter("cgids", cgids)
                    .getResultList();
        }

        return classgroupmembers.stream()
                .map(this::convertToActivityViewModel)
                .toList().stream().findFirst();
    }

    // 修正後的方法
    public List<ClassGroupMemberModel> findDataByTea(Integer uid, String llmtype) {
        List<Classgroupmember> classgroupmembers = entityManager.createQuery(
                        "SELECT p FROM Classgroupmember p " +
                                "JOIN FETCH p.cgid " +
                                "JOIN FETCH p.memberCid " +
                                "JOIN FETCH p.cgid.ocid " +
                                "JOIN FETCH p.cgid.ocid.eid " +
                                "JOIN FETCH p.cgid.ocid.createduid " +
                                "WHERE p.cgid.ocid.createduid.id = :uid " +
                                "AND p.cgid.ocid.llmtype = :llmtype " +
                                "ORDER BY p.cgid.ocid.classname", Classgroupmember.class)
                .setParameter("uid", uid)
                .setParameter("llmtype", llmtype)
                .getResultList();

        List<ClassGroupMemberModel> result = new ArrayList<>();
        classgroupmembers.forEach(classgroupmember -> {
            result.add(convertToViewModel(classgroupmember));
        });
        return result;
    }

    private ClassGroupMemberModel convertToViewModel(Classgroupmember member) {
        ClassGroupMemberModel classGroupMemberModel = new ClassGroupMemberModel();
        classGroupMemberModel.setId(member.getId());
        classGroupMemberModel.setOcid(member.getCgid().getOcid().getId());
        classGroupMemberModel.setGroupname(member.getCgid().getGroupname());
        classGroupMemberModel.setCgid(member.getCgid().getId());
        classGroupMemberModel.setMembercid(member.getMemberCid().getUid().getId());

        // 直接在這裡設定需要的值，避免在 UI 層存取深層關聯
        if (member.getCgid().getOcid().getEid() != null) {
            classGroupMemberModel.setTitle(member.getCgid().getOcid().getEid().getTitle());
            classGroupMemberModel.setClassname(member.getCgid().getOcid().getClassname());
        }

        classGroupMemberModel.setClassinfo(new ClassInfoModel().convertToEntity(member.getMemberCid()));
        classGroupMemberModel.setClassgroup(new ClassGroupModel(member.getCgid(), null));

        return classGroupMemberModel;
    }

    private STActivityModel convertToActivityViewModel(Classgroupmember member) {
        STActivityModel stActivityModel = new STActivityModel();
        stActivityModel.setId(member.getId());
        stActivityModel.setOcid(member.getCgid().getOcid().getId());
        stActivityModel.setGroupname(member.getCgid().getGroupname());
        stActivityModel.setCgid(member.getCgid().getId());
        stActivityModel.setMembercid(member.getMemberCid().getId());

        // 載入群組成員名單
        String memberlist = loadGroupMemberNames(member.getCgid().getId());
//        logger.debug("--------------memberlist 1:{}", memberlist);
        stActivityModel.setMemberlist(memberlist);
//        logger.debug("--------------memberlist 2:{}", memberlist);
        // 設定標題
        if (member.getCgid().getOcid().getEid() != null) {
            stActivityModel.setClassname(member.getCgid().getOcid().getClassname());
            stActivityModel.setTitle(member.getCgid().getOcid().getEid().getTitle());
            stActivityModel.setEssayid(member.getCgid().getOcid().getEid().getId());
            stActivityModel.setGenreid(member.getCgid().getOcid().getEid().getGid().getId());
        }
//        logger.debug("--------------stActivityModel :{}", stActivityModel);
        return stActivityModel;
    }

    private String loadGroupMemberNames(Integer cgid) {
        try {
            List<Classgroupmember> groupMembers = entityManager.createQuery(
                            "SELECT cgm FROM Classgroupmember cgm " +
                                    "JOIN FETCH cgm.memberCid " +
                                    "JOIN FETCH cgm.memberCid.uid " +
                                    "WHERE cgm.cgid.id = :cgid", Classgroupmember.class)
                    .setParameter("cgid", cgid)
                    .getResultList();

            logger.debug("--------------groupMembers:{}", groupMembers);

            String memberlist = groupMembers.stream()
                    .filter(cgm -> cgm.getMemberCid() != null && cgm.getMemberCid().getUid() != null)
                    .map(cgm -> cgm.getMemberCid().getUid().getName())
                    .filter(name -> name != null && !name.trim().isEmpty())
                    .collect(Collectors.joining(","));

            logger.debug("-------Loaded member names for group {}: {}", cgid, memberlist);
            return memberlist;

        } catch (Exception e) {
            logger.debug("Error loading member names for group {}: {}", cgid, e.getMessage());
            return "載入成員資料時發生錯誤";
        }
    }

    public List<ClassinfoViewModel> loadGroupMemberList(Integer cgid) {
        try {
            List<Classgroupmember> groupMembers = entityManager.createQuery(
                            "SELECT cgm FROM Classgroupmember cgm " +
                                    "JOIN FETCH cgm.memberCid " +
                                    "JOIN FETCH cgm.memberCid.uid " +
                                    "WHERE cgm.cgid.id = :cgid", Classgroupmember.class)
                    .setParameter("cgid", cgid)
                    .getResultList();

//            logger.debug("找到 {} 位組員", groupMembers.size());

            List<ClassinfoViewModel> memberInfoList = groupMembers.stream()
                    .filter(cgm -> cgm.getMemberCid() != null && cgm.getMemberCid().getUid() != null)
                    .filter(cgm -> cgm.getMemberCid().getUid().getName() != null &&
                            !cgm.getMemberCid().getUid().getName().trim().isEmpty())
                    .map(cgm -> new ClassinfoViewModel(
                            cgm.getMemberCid().getId(),//cid
                            cgm.getMemberCid().getUid().getName()
                    ))
                    .collect(Collectors.toList());

//            logger.debug("成功載入群組 {} 的 {} 位成員資料", cgid, memberInfoList.size());
            return memberInfoList;

        } catch (Exception e) {
            logger.debug("載入群組 {} 成員資料時發生錯誤: {}", cgid, e.getMessage(), e);
            return new ArrayList<>();  // 回傳空列表而不是錯誤訊息
        }
    }

    public List<Classgroupmember> findDataByCgid(int cgid) {
        TypedQuery<Classgroupmember> query = entityManager.createQuery(
                        "SELECT p FROM Classgroupmember p " +
                                "WHERE p.cgid.id = :cgid ORDER BY p.id", Classgroupmember.class)
                .setParameter("cgid", cgid);
        return query.getResultList();
    }

    public Classgroupmember findById(Long id) {
        return entityManager.find(Classgroupmember.class, id);
    }
}