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
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagelog;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagerecord;

import java.util.List;
import java.util.Optional;

import static com.mongodb.client.model.Filters.eq;

/**
 * 實作 IStagerecordRepository
 */
@Stateless
@Local(IStagerecordRepository.class)
public class StagerecordRepositoryImpl implements IStagerecordRepository {
    @PersistenceContext
    private EntityManager entityManager;

    @Inject
    private IRDBCrudService<Stagerecord> crudService;

    private static final Logger logger = LoggerFactory.getLogger(StagerecordRepositoryImpl.class);


    @Override
    public List<Stagerecord> findTreeByUIDCGID(int cid, int cgid) {
        return entityManager.createQuery(
                        "SELECT s FROM Stagerecord s " +
                                "LEFT JOIN FETCH s.cid " +
                                "WHERE s.cid.id = :cid " +
                                "AND s.cgid.id = :cgid " +
                                "AND s.istree = '1' ",
                        Stagerecord.class)
                .setParameter("cid", cid).setParameter("cgid", cgid).getResultList();
    }

    @Override
    public List<Stagerecord> findContentByUIDCGID(int cid, int cgid, int stageid, int seq) {
        return entityManager.createQuery(
                        "SELECT s FROM Stagerecord s " +
                                "LEFT JOIN FETCH s.cid " +
                                "WHERE s.cid.id = :cid " +
                                "AND s.cgid.id = :cgid " +
                                "AND s.stageid.id = :stageid " +
                                "AND s.seq = :seq ",
                        Stagerecord.class)
                .setParameter("cid", cid)
                .setParameter("cgid", cgid)
                .setParameter("stageid", stageid)
                .setParameter("seq", seq).getResultList();
    }

    @Override
    public List<Stagerecord> getNewSeqByUIDCGID(int cid, int cgid, int stageid) {
        try {
            return entityManager.createQuery(
                            "SELECT s FROM Stagerecord s " +
                                    "LEFT JOIN FETCH s.cid " +
                                    "WHERE s.cid.id = :cid " +
                                    "AND s.cgid.id = :cgid " +
                                    "AND s.stageid.id = :stageid " +
                                    "ORDER BY s.seq DESC",
                            Stagerecord.class)
                    .setParameter("cid", cid)
                    .setParameter("cgid", cgid)
                    .setParameter("stageid", stageid)
                    .setMaxResults(1)
                    .getResultList();
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public List<Stagerecord> getNewSeqByUIDCGID(int cid, int cgid) {
        try {
            return entityManager.createQuery(
                            "SELECT s FROM Stagerecord s " +
                                    "LEFT JOIN FETCH s.cid " +
                                    "WHERE s.cid.id = :cid " +
                                    "AND s.cgid.id = :cgid " +
                                    "AND s.stageid.id = :stageid " +
                                    "ORDER BY s.seq DESC",
                            Stagerecord.class)
                    .setParameter("cid", cid)
                    .setParameter("cgid", cgid)
                    .setMaxResults(1)
                    .getResultList();
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    @Transactional
    public void save(Stagerecord stagerecord) {
        if (stagerecord.getId() == null) {
            entityManager.persist(stagerecord);
        } else {
            entityManager.merge(stagerecord);
        }
    }
}
