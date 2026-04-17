package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Step;
import java.util.List;

@Local
public interface IStepRepository {

    Step findId(int id);

    Step referenceById(int id);

    List<Step> getAllSteps();

    List<Step> getStepsByStageId(Integer stageId);

    void createStep(Step step);
}
