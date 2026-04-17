package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.Composescore;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essayquestion;
import tw.com.slsinfo.essayai.models.course.LLMStageQuestionsModel;
import tw.com.slsinfo.essayai.repositories.IEssayquestionRepository;

import java.util.ArrayList;
import java.util.List;

@Stateless
public class EssayquestionRepositoryImpl implements IEssayquestionRepository {

    @PersistenceContext
    private EntityManager em;

    @Inject
    private IRDBCrudService<Essayquestion> essayquestionIRDBCrudService;

    @Override
    public Essayquestion findId(int id) {
        return em.find(Essayquestion.class, id);
    }

    @Override
    public Essayquestion referenceById(int id) {
        return em.getReference(Essayquestion.class, id);
    }

    @Override
    public Essayquestion updateEntity(Essayquestion essayquestion) {
        return em.merge(essayquestion);
    }

    @Override
    public List<Essayquestion> getQuestionsByEssayId(Integer essayId) {
        return essayquestionIRDBCrudService.findWithNamedQuery(NamedQueryNames.GET_STAGE_QUESTIONS_BY_EID,
                QueryParameterBuilder.start("essayId", essayId).build());
    }

    /**
     * 取得LLM所需問題庫
     *
     * @param essayId
     * @return
     */
    @Override
    public List<LLMStageQuestionsModel> getLLMStageQuestionsByEssayId(Integer essayId) {
        List<LLMStageQuestionsModel> llmStageQuestionsModels = new ArrayList<>();
        getQuestionsByEssayId(essayId).forEach(essayquestion -> {
            LLMStageQuestionsModel llmStageQuestionsModel = new LLMStageQuestionsModel();
            llmStageQuestionsModel.setQuestion(essayquestion.getQuestion());
            llmStageQuestionsModel.setStageId(essayquestion.getStepid().getStageid().getId());
            llmStageQuestionsModel.setEssayTitle(essayquestion.getEssayid().getTitle());
            llmStageQuestionsModel.setEssayId(essayquestion.getEssayid().getId());
            llmStageQuestionsModel.setStepName(essayquestion.getStepid().getStepname());
            llmStageQuestionsModel.setStepSort(essayquestion.getStepid().getStepsort());
            llmStageQuestionsModel.setType(essayquestion.getStepid().getType());
            llmStageQuestionsModels.add(llmStageQuestionsModel);
        });
        return llmStageQuestionsModels;
    }

    @Override
    public List<LLMStageQuestionsModel> getLLMStageQuestionsByIds(Integer essayId, Integer stageId) {
        List<LLMStageQuestionsModel> llmStageQuestionsModels = new ArrayList<>();
        getQuestionsByIds(essayId, stageId).forEach(essayquestion -> {
            LLMStageQuestionsModel llmStageQuestionsModel = new LLMStageQuestionsModel();
            llmStageQuestionsModel.setQuestion(essayquestion.getQuestion());
            llmStageQuestionsModel.setStageId(stageId);
            llmStageQuestionsModel.setQuestionId(essayquestion.getId());
            llmStageQuestionsModel.setEssayTitle(essayquestion.getEssayid().getTitle());
            llmStageQuestionsModel.setEssayId(essayquestion.getEssayid().getId());
            llmStageQuestionsModel.setStepName(essayquestion.getStepid().getStepname());
            llmStageQuestionsModel.setStepSort(essayquestion.getStepid().getStepsort());
            llmStageQuestionsModel.setType(essayquestion.getStepid().getType());
            llmStageQuestionsModels.add(llmStageQuestionsModel);
        });
        return llmStageQuestionsModels;
    }

    @Override
    public List<Essayquestion> getQuestionsByIds(Integer essayId, Integer stageId) {
        return essayquestionIRDBCrudService.findWithNamedQuery(NamedQueryNames.GET_STAGE_QUESTIONS_BY_IDS,
                QueryParameterBuilder.start("essayId", essayId).with("stageId", stageId).build());
    }


    @Override
    public void createEssayquestion(Essayquestion essayquestion) {
        em.persist(essayquestion);
    }

    @Override
    public void deleteEssayquestion(Integer id) {
        Essayquestion essayquestion = findId(id);
        if (essayquestion != null) {
            em.remove(essayquestion);
        }
    }
}