package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.NoResultException;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.*;
import tw.com.slsinfo.essayai.models.course.ClassinfoViewModel;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 實作 ISchoolRepository
 */
@Stateless
@Local(IClassgroupMemberRepository.class)
public class ClassgroupmemberRepositoryImpl implements IClassgroupMemberRepository {

    private static final Logger logger = LoggerFactory.getLogger(ClassgroupmemberRepositoryImpl.class);

    @PersistenceContext
    private EntityManager em;

    @Inject
    private IRDBCrudService<Classgroupmember> classgroupmemberIRDBCrudService;

    @Override
    public Classgroupmember findId(int id) {

        return classgroupmemberIRDBCrudService.find(Classgroupmember.class, id);
    }

    @Override
    public Classgroupmember referenceById(int id) {
        return classgroupmemberIRDBCrudService.reference(Classgroupmember.class, id);
    }

    @Override
    public List<Classgroupmember> findByUid(User uid) {
        return classgroupmemberIRDBCrudService.findWithNamedQuery(NamedQueryNames.GET_STU_GROUP_BY_UID,
                QueryParameterBuilder.start("uid", uid).build());
    }

    @Override
    public Classgroupmember updateEntity(Classgroupmember classgroup) {
        return classgroupmemberIRDBCrudService.update(classgroup);
    }

    @Override
    public List<ClassinfoViewModel> getClassgroupmembercidFilter(Integer cgid) {
        List<Operator> operators = new ArrayList<>();
        operators.add(new Operator(Operator.Condition.EQ, "cgid.id", cgid));
//        return classgroupmemberIRDBCrudService.dynamicQuery(Classgroupmember.class, operators);

        List<Classgroupmember> classinfos = classgroupmemberIRDBCrudService.dynamicQuery(Classgroupmember.class, operators);
        List<ClassinfoViewModel> results = new ArrayList<>();

        classinfos.forEach(e -> {
            results.add(ClassinfoViewModel.createNew(e));
        });

        return results;
    }

    @Override
    public List<Classgroupmember> findByMemberCid(Integer memberCid) {
        return List.of();
    }

    @Override
    public Classgroupmember save(Classgroupmember classgroupmember) {
        try {
            if (classgroupmember.getId() == null) {
                em.persist(classgroupmember);
                return classgroupmember;
            } else {
                return em.merge(classgroupmember);
            }
        } catch (Exception e) {
            logger.debug("儲存分組成員失敗，cgid: {}, memberCid: {}",
                    classgroupmember.getCgid(), classgroupmember.getMemberCid(), e);
            throw new RuntimeException("儲存分組成員失敗", e);
        }
    }

    @Override
    public void delete(Classgroupmember classgroupmember) {
        try {
            Classgroupmember managedGroup = em.contains(classgroupmember) ? classgroupmember : em.merge(classgroupmember);
            em.remove(managedGroup);

//            if (em.contains(classgroupmember)) {
//                em.remove(classgroupmember);
//                classgroupmemberIRDBCrudService.delete(Classgroupmember.class, classgroupmember.getId());
////                essayIRDBCrudService.delete(Essay.class, eid);
//            } else {
//                Classgroupmember managedEntity = em.find(Classgroupmember.class, classgroupmember.getId());
//                if (managedEntity != null) {
//                    em.remove(managedEntity);
//                }
//            }
        } catch (Exception e) {
            logger.debug("刪除分組成員失敗，id: {}", classgroupmember.getId(), e);
            throw new RuntimeException("刪除分組成員失敗", e);
        }
    }

    @Override
    public void deleteByCgid(Integer cgid) {
        try {
            em.createQuery("DELETE FROM Classgroupmember cgm WHERE cgm.cgid.id = :cgid")
                    .setParameter("cgid", cgid)
                    .executeUpdate();
        } catch (Exception e) {
            logger.debug("根據分組ID刪除成員失敗，cgid: {}", cgid, e);
            throw new RuntimeException("根據分組ID刪除成員失敗", e);
        }
    }

    @Override
    public void deleteByOcid(Integer ocid) {
        try {
            em.createQuery(
                    "DELETE FROM Classgroupmember cgm " +
                            "WHERE cgm.cgid.id IN " +
                            "(SELECT cg.id FROM Classgroup cg " +
                            "WHERE cg.ocid.id = :ocid)"
            ).setParameter("ocid", ocid).executeUpdate();
        } catch (Exception e) {
            logger.debug("根據開課ID刪除所有成員失敗，ocid: {}", ocid, e);
            throw new RuntimeException("根據開課ID刪除所有成員失敗", e);
        }
    }

    @Override
    public List<Classgroupmember> saveAll(List<Classgroupmember> members) {
        try {
            for (Classgroupmember member : members) {
                if (member.getId() == null) {
                    em.persist(member);
                } else {
                    em.merge(member);
                }
            }
            em.flush();
            return members;
        } catch (Exception e) {
            logger.debug("批次儲存分組成員失敗", e);
            throw new RuntimeException("批次儲存分組成員失敗", e);
        }
    }

    @Override
    public List<Classgroupmember> findByOcid(Integer ocid) {
        return em.createQuery(
                        "SELECT c FROM Classgroupmember c " +
                                "WHERE c.cgid.ocid.id = :ocid " +
                                "AND c.memberCid.uid.id IN " +
                                "(SELECT r.uid.id FROM Roleuser r WHERE r.rid.id = 2)",
                        Classgroupmember.class)
                .setParameter("ocid", ocid)
                .getResultList();
//        return em.createQuery(
//                        "SELECT m FROM Classgroupmember m " +
//                                "WHERE m.cgid.ocid.id = :ocid",
//                        Classgroupmember.class)
//                .setParameter("ocid", ocid)
//                .getResultList();
    }

    @Override
    public List<Classgroupmember> findByCgid(Integer cgid) {
        return em.createQuery(
                        "SELECT m FROM Classgroupmember m " +
                                "LEFT JOIN FETCH m.memberCid " +
                                "LEFT JOIN FETCH m.memberCid.uid " +
                                "LEFT JOIN FETCH m.cgid " +
                                "WHERE m.cgid.id = :cgid",
                        Classgroupmember.class)
                .setParameter("cgid", cgid)
                .getResultList();
    }

    @Override
    public Classgroupmember findByMemberCid(Integer memberCid, Integer ocid) {
        try {
            return em.createQuery(
                            "SELECT m FROM Classgroupmember m " +
                                    "LEFT JOIN FETCH m.memberCid " +
                                    "LEFT JOIN FETCH m.cgid " +
                                    "LEFT JOIN FETCH m.cgid.ocid " +
                                    "WHERE m.memberCid.id = :memberCid " +
                                    "AND m.cgid.ocid.id = :ocid",
                            Classgroupmember.class)
                    .setParameter("memberCid", memberCid)
                    .setParameter("ocid", ocid)
                    .getSingleResult();
        } catch (NoResultException e) {
            return null;
        }
    }

    @Override
    @Transactional
    public void deleteByMemberCid(Integer memberCid, Integer ocid) {
        try {
            em.createQuery(
                    "DELETE FROM Classgroupmember cgm " +
                            "WHERE cgm.cgid.id IN " +
                            "(SELECT cg.id FROM Classgroup cg " +
                            "WHERE cg.ocid.id = :ocid" +
                            " and cgm.memberCid.id = :cid)"
            ).setParameter("ocid", ocid).setParameter("cid", memberCid).executeUpdate();
        } catch (Exception e) {
            logger.debug("根據開課ID刪除所有成員失敗，ocid: {}", ocid, e);
            throw new RuntimeException("根據開課ID刪除所有成員失敗", e);
        }
    }

    @Override
    public boolean existsByMemberCidAndCgid(Integer studentId, Integer groupId) {
        return false;
    }

// GroupManageService.java

    /**
     * 設定組長
     * @param groupId 組別ID
     * @param studentId 要設為組長的學生ID
     */
    @Override
    @Transactional
    public void setCaptain(Integer groupId, Integer studentId) {
        try {
            // 1. 先將該組所有成員的組長標記清除
            List<Classgroupmember> members = em
                    .createQuery("SELECT m FROM Classgroupmember m WHERE m.cgid.id = :groupId",
                            Classgroupmember.class)
                    .setParameter("groupId", groupId)
                    .getResultList();

            for (Classgroupmember member : members) {
                member.setIsCaptain("N");
                em.merge(member);
            }

            // 2. 設定新的組長
            List<Classgroupmember> targetMembers = em
                    .createQuery("SELECT m FROM Classgroupmember m " +
                                    "WHERE m.cgid.id = :groupId AND m.memberCid.id = :studentId",
                            Classgroupmember.class)
                    .setParameter("groupId", groupId)
                    .setParameter("studentId", studentId)
                    .getResultList();

            if (!targetMembers.isEmpty()) {
                Classgroupmember captain = targetMembers.get(0);
                captain.setIsCaptain("Y");
                em.merge(captain);
                logger.debug("成功設定組長 - 組別: {}, 學生: {}", groupId, studentId);
            } else {
                throw new RuntimeException("找不到指定的組員");
            }

            em.flush();

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
    @Override
    @Transactional
    public void removeCaptain(Integer groupId, Integer studentId) {
        try {
            List<Classgroupmember> members = em
                    .createQuery("SELECT m FROM Classgroupmember m " +
                                    "WHERE m.cgid.id = :groupId AND m.memberCid.id = :studentId",
                            Classgroupmember.class)
                    .setParameter("groupId", groupId)
                    .setParameter("studentId", studentId)
                    .getResultList();

            if (!members.isEmpty()) {
                Classgroupmember member = members.get(0);
                member.setIsCaptain("N");
                em.merge(member);
                em.flush();
                logger.debug("成功取消組長 - 組別: {}, 學生: {}", groupId, studentId);
            }

        } catch (Exception e) {
            logger.debug("取消組長失敗", e);
            throw new RuntimeException("取消組長失敗: " + e.getMessage());
        }
    }
}
