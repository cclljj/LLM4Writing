package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essayquestion;
import tw.com.slsinfo.essayai.models.course.LLMStageQuestionsModel;

import java.util.List;

@Local
public interface IEssayquestionRepository {

    Essayquestion findId(int id);

    Essayquestion referenceById(int id);

    Essayquestion updateEntity(Essayquestion essayquestion);

    List<Essayquestion> getQuestionsByEssayId(Integer essayId);

    List<LLMStageQuestionsModel> getLLMStageQuestionsByEssayId(Integer essayId);

    List<LLMStageQuestionsModel> getLLMStageQuestionsByIds(Integer essayId, Integer stageId);

    List<Essayquestion> getQuestionsByIds(Integer essayId, Integer stageId);

    void createEssayquestion(Essayquestion essayquestion);

    void deleteEssayquestion(Integer id);
}