package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.essayai.databases.mysql.entities.Staticquestion;
import tw.com.slsinfo.essayai.databases.mysql.entities.Step;
import tw.com.slsinfo.essayai.repositories.IStepRepository;

import java.util.List;

@Stateless
@Local(IStepRepository.class)
public class StepRepositoryImpl implements IStepRepository {

    @PersistenceContext
    private EntityManager em;

    @Inject
    private IRDBCrudService<Step> stepIRDBCrudService;


    @Override
    public Step findId(int id) {
        return em.find(Step.class, id);
    }

    @Override
    public Step referenceById(int id) {
        return em.getReference(Step.class, id);
    }

    @Override
    public List<Step> getAllSteps() {
        TypedQuery<Step> query = em.createQuery(
                "SELECT s FROM Step s ORDER BY s.stepsort",
                Step.class);
        return query.getResultList();
    }

    @Override
    public List<Step> getStepsByStageId(Integer stageId) {
        TypedQuery<Step> query = em.createQuery(
                "SELECT s FROM Step s WHERE s.stageid.id = :stageId ORDER BY s.stepsort",
                Step.class);
        query.setParameter("stageId", stageId);
        return query.getResultList();
    }

    @Override
    public void createStep(Step step) {
        em.persist(step);
    }
}
