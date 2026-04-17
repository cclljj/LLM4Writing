package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagelog;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagerecord;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;

import java.time.Instant;
import java.util.List;

@Stateless
@Local(IStagelogRepository.class)
public class StagelogRepositoryImpl implements IStagelogRepository {

    private static final Logger logger = LoggerFactory.getLogger(StagelogRepositoryImpl.class);

    @Inject
    private IRDBCrudService<Stagelog> stagelogIRDBCrudService;

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Stagelog findId(int id) {
        return stagelogIRDBCrudService.find(Stagelog.class, id);
    }

    @Override
    public Stagelog referenceById(int id) {
        return stagelogIRDBCrudService.reference(Stagelog.class, id);
    }

    @Override
    public Stagelog updateEntity(Stagelog stagelog) {
        return stagelogIRDBCrudService.update(stagelog);
    }

    /**
     * {@inheritDoc}
     *
     * @param cid  classinfo id
     * @param cgid classgroups id
     * @return
     */
    @Override
    public List<Stagelog> findCurrentStagelog(Integer cid, Integer cgid) {
        return stagelogIRDBCrudService.findWithNamedQuery(NamedQueryNames.GET_CURRENT_ACTIVITY_BY_CID_CGID,
                QueryParameterBuilder.start("cgid", cgid).with("cid", cid).build());
    }


    /**
     * {@inheritDoc}
     *
     * @param cgid
     * @param chattype
     * @return
     */
    @Override
    public List<Stagelog> findNewStagelog(Integer cgid, String chattype) {
        try {
            return entityManager.createQuery(
                            "SELECT s FROM Stagelog s " +
                                    "LEFT JOIN FETCH s.cid " +
                                    "LEFT JOIN FETCH s.stageid " +
                                    "WHERE s.cgid.id = :cgid " +
                                    "AND s.stageid.chattype = :chattype " +
                                    "ORDER BY s.created DESC",
                            Stagelog.class)
                    .setParameter("cgid", cgid)
                    .setParameter("chattype", chattype)
                    .setMaxResults(1)
                    .getResultList();
        } catch (Exception e) {
            return List.of();
        }
    }


    /**
     * {@inheritDoc}
     *
     * @param ocid
     * @param chattype
     * @return
     */
    @Override
    public Integer findNewStagelogIdInOpenClass(Integer ocid) {
        try {
            List<Stagelog> stagelogList =
                    entityManager.createQuery(
                                    "SELECT s FROM Stagelog s " +
                                            "WHERE s.ocid.id = :ocid " +
                                            "ORDER BY s.stageid.id DESC",
                                    Stagelog.class)
                            .setParameter("ocid", ocid)
                            .setMaxResults(1)
                            .getResultList();
            logger.debug("findNewStagelogIdInOpenClass size {}", stagelogList.size());
            if (stagelogList.isEmpty()) {
                return 0;
            } else {
                return stagelogList.get(0).getStageid().getId();
            }
        } catch (Exception e) {
            return 0;
        }
    }

    public List<Stagelog> findNewStagelog(Integer ocid) {
        try {
            return entityManager.createQuery(
                            "SELECT s FROM Stagelog s " +
                                    "LEFT JOIN FETCH s.cid " +
                                    "LEFT JOIN FETCH s.stageid " +
                                    "WHERE s.ocid.id = :ocid " +
//                                    "AND s.stageid.chattype = :chattype " +
                                    "ORDER BY s.created DESC",
                            Stagelog.class)
                    .setParameter("ocid", ocid)
//                    .setParameter("chattype", chattype)
                    .setMaxResults(1)
                    .getResultList();
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    @Transactional
    public void save(Stagelog stagelog) {
        if (stagelog.getId() == null) {
            entityManager.persist(stagelog);
        } else {
            entityManager.merge(stagelog);
        }
    }

    @Override
    public boolean existsDuplicateStagelog(String responseid, String messageid,
                                           Integer stageId, Integer cgid,
                                           Integer ocid, Integer cid, String isend) {
        try {
            String jpql = "SELECT COUNT(s) FROM Stagelog s " +
                    "WHERE s.responseid = :responseid " +
                    "AND (:messageid IS NULL OR s.messageid = :messageid) " +
                    "AND s.stageid.id = :stageId " +
                    "AND s.cgid.id = :cgid " +
                    "AND s.ocid.id = :ocid " +
                    "AND s.cid.id = :cid " +
                    "AND s.isend = :isend ";

            TypedQuery<Long> query = entityManager.createQuery(jpql, Long.class);
            query.setParameter("responseid", responseid);
            query.setParameter("messageid", messageid);
            query.setParameter("stageId", stageId);
            query.setParameter("cgid", cgid);
            query.setParameter("ocid", ocid);
            query.setParameter("cid", cid);
            query.setParameter("isend", isend);

            Long count = query.getSingleResult();
            logger.debug("existsDuplicateStagelog.count:{}", count);
            return count > 0;

        } catch (Exception e) {
            return false;
        }
    }

}
