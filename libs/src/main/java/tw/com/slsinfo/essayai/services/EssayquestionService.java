package tw.com.slsinfo.essayai.services;

import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essayquestion;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essay;
import tw.com.slsinfo.essayai.databases.mysql.entities.Step;
import tw.com.slsinfo.essayai.models.course.EssayquestionViewModel;
import tw.com.slsinfo.essayai.models.course.LLMStageQuestionsModel;
import tw.com.slsinfo.essayai.repositories.IEssayquestionRepository;
import tw.com.slsinfo.essayai.repositories.IEssayRepository;
import tw.com.slsinfo.essayai.repositories.IStepRepository;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentSkipListSet;
import java.util.stream.Collectors;

@Stateless
public class EssayquestionService {

    @Inject
    private IEssayquestionRepository iEssayquestionRepository;

    @Inject
    private IEssayRepository iEssayRepository;

    @Inject
    private IStepRepository iStepRepository;

    private static final Logger logger = LogManager.getLogger(EssayquestionService.class);

    public List<EssayquestionViewModel> getQuestionsViewByEssayId(Integer essayId) {
        return iEssayquestionRepository.getQuestionsByEssayId(essayId)
                .stream()
                .map(EssayquestionViewModel::createNew)
                .toList();
    }

    public EssayquestionViewModel getQuestionViewById(Integer id) {
        Essayquestion question = iEssayquestionRepository.findId(id);
        return question != null ? EssayquestionViewModel.createNew(question) : null;
    }

    public boolean createEssayquestion(EssayquestionViewModel viewModel) {
        try {
            logger.debug("createEssayquestion------{}", viewModel.toString());
            Essay essay = iEssayRepository.referenceById(viewModel.getEssayId());
            Step step = iStepRepository.referenceById(viewModel.getStepId());

            Essayquestion essayquestion = new Essayquestion();
            essayquestion.setEssayid(essay);
            essayquestion.setStepid(step);
            essayquestion.setQuestion(viewModel.getQuestion());
            essayquestion.setCreated(Instant.now());

            iEssayquestionRepository.createEssayquestion(essayquestion);
            return true;
        } catch (Exception e) {
            logger.debug("建立問題失敗", e);
            return false;
        }
    }

    public void updateEssayquestion(EssayquestionViewModel viewModel) {
        Essayquestion essayquestion = iEssayquestionRepository.findId(viewModel.getId());
        if (essayquestion != null) {
            Step step = iStepRepository.referenceById(viewModel.getStepId());
            essayquestion.setStepid(step);
            essayquestion.setQuestion(viewModel.getQuestion());
            iEssayquestionRepository.updateEntity(essayquestion);
        }
    }

    public List<LLMStageQuestionsModel> getLLMStageQuestionsByIds(Integer essayId, Integer stageId) {
        return iEssayquestionRepository.getLLMStageQuestionsByIds(essayId, stageId);
    }

    /**
     * 取得依出題序號排序後的問題庫
     *
     * @param essayId
     * @param stageId
     * @return
     */
    public Set<LLMStageQuestionsModel> getLLMStageQuestionSetByIds(Integer essayId, Integer stageId) {
//        AbstractSet<LLMStageQuestionsModel> llmStageQuestionsModels = new ConcurrentSkipListSet<>(
//                Comparator.comparingInt(LLMStageQuestionsModel::getStepSort).thenComparing(LLMStageQuestionsModel::getQuestionId));
        AbstractSet<LLMStageQuestionsModel> llmStageQuestionsModels = new ConcurrentSkipListSet<>(
                Comparator.comparingInt(LLMStageQuestionsModel::getStepSort));
        llmStageQuestionsModels.addAll(getLLMStageQuestionsByIds(essayId, stageId));
        return llmStageQuestionsModels;
    }

    public List<LLMStageQuestionsModel> getLLMStageQuestionsByEssayId(Integer essayId) {
        return iEssayquestionRepository.getLLMStageQuestionsByEssayId(essayId);
    }


    public void deleteEssayquestion(Integer id) {
        iEssayquestionRepository.deleteEssayquestion(id);
    }
}