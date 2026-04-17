package tw.com.slsinfo.essayai.services;

import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stage;
import tw.com.slsinfo.essayai.databases.mysql.entities.Step;
import tw.com.slsinfo.essayai.repositories.IStageRepository;
import tw.com.slsinfo.essayai.repositories.IStepRepository;

import java.time.Instant;
import java.util.List;

@Stateless
public class StepService {

    @Inject
    private IStepRepository iStepRepository;

    @Inject
    private IStageRepository iStageRepository;

    private static final Logger logger = LogManager.getLogger(StepService.class);

    public List<Step> getAllSteps() {
        return iStepRepository.getAllSteps();
    }

    public List<Step> getStepsByStageId(Integer stageId) {
        return iStepRepository.getStepsByStageId(stageId);
    }

    public Step getStepById(Integer id) {
        return iStepRepository.findId(id);
    }

    public boolean createStep(Integer stageId, String stepname, Integer stepsort) {
        try {
            Stage stage = iStageRepository.referenceById(stageId);

            Step step = new Step();
            step.setStageid(stage);
            step.setStepname(stepname);
            step.setStepsort(stepsort);
            step.setCreated(Instant.now());

            iStepRepository.createStep(step);
            return true;
        } catch (Exception e) {
            logger.debug("建立步驟失敗", e);
            return false;
        }
    }
}