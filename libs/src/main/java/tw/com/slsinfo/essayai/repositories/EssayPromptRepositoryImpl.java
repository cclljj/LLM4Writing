package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.*;
import tw.com.slsinfo.essayai.models.course.StagePromptModel;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Stateless
@Local(IEssayPromptRepository.class)
public class EssayPromptRepositoryImpl implements IEssayPromptRepository {

    private static final Logger log = LogManager.getLogger(EssayPromptRepositoryImpl.class);

    @Inject
    private IRDBCrudService<Classstageprompt> classstagepromptService;

    @Inject
    private IRDBCrudService<Essayprompt> essaypromptService;

    @Inject
    private IRDBCrudService<Stage> stageService;

    @Inject
    private IStageRepository stageRepository;
    @Inject
    private IEssayRepository essayRepository;

    @Override
    public Essayprompt findEssayPromptByEssayIdAndStageId(Integer essayid, Integer stageid) {
        try {
            List<Essayprompt> results = essaypromptService.findWithNamedQuery(
                    "Essayprompt.findByEssayIdAndStageId",
                    QueryParameterBuilder.start("essayid", essayid)
                            .with("stageid", stageid)
                            .build()
            );
            log.debug("--------results:{}", results);
            return results.isEmpty() ? null : results.get(0);
        } catch (Exception e) {
            log.error("查找 Essayprompt 時發生錯誤: essayid={}, stageid={}", essayid, stageid, e);
            return null;
        }
    }

    @Override
    public List<StagePromptModel> getStagePromptModels(Integer essayid,
                                                       String llmtype, String chattype) {
        List<StagePromptModel> models = new ArrayList<>();

        try {
            if (chattype != null) {
                // 1. 取得所有符合條件的 Stage
                List<Stage> stages = stageService.findWithNamedQuery(
                        NamedQueryNames.GET_ALL_STAGE,
                        QueryParameterBuilder.start("llmtype", llmtype)
                                .with("chattype", chattype)
                                .build()
                );

                // 2. 為每個 Stage 建立 Model
                for (Stage stage : stages) {
                    StagePromptModel model = buildStagePromptModel(essayid, stage);
                    models.add(model);
                }
            } else {
                // 1. 取得所有符合條件的 Stage
                List<Stage> stages = stageService.findWithNamedQuery(
                        NamedQueryNames.GET_STAGE,
                        QueryParameterBuilder.start("llmtype", llmtype)
                                .build()
                );

                // 2. 為每個 Stage 建立 Model
                for (Stage stage : stages) {
                    StagePromptModel model = buildStagePromptModel(essayid, stage);
                    models.add(model);
                }
            }
        } catch (Exception e) {
            log.error("取得 StagePromptModels 時發生錯誤", e);
        }

        return models;
    }

    @Override
    public StagePromptModel getStagePromptModel(Integer essayid, Integer stageid) {
        try {
            Stage stage = stageRepository.findId(stageid);
            if (stage == null) {
                log.warn("找不到 Stage: stageid={}", stageid);
                return null;
            }

            return buildStagePromptModel(essayid, stage);

        } catch (Exception e) {
            log.error("取得 StagePromptModel 時發生錯誤: stageid={}", stageid, e);
            return null;
        }
    }

    /**
     * 建立 StagePromptModel (核心邏輯)
     */
    private StagePromptModel buildStagePromptModel(Integer essayid, Stage stage) {
        log.debug("------------buildStagePromptModel:{},{}", essayid, stage);
        StagePromptModel model = new StagePromptModel();
        // 設定 Stage 基本資訊
        model.setStageId(stage.getId());
        model.setStageName(stage.getStagename());
        model.setLlmtype(stage.getLlmtype());
        model.setChattype(stage.getChattype());
        model.setEssayid(essayid);

        // 使用範本
        Essayprompt essayPrompt = findEssayPromptByEssayIdAndStageId(essayid, stage.getId());
        if (essayPrompt != null) {
            model.setPromptText(essayPrompt.getPrompt());
            model.setEssaypromptId(essayPrompt.getId());
        } else {
            model.setPromptText(""); // 無範本
            model.setEssaypromptId(null);
        }
        model.setCustomized(false);
        model.setClasspromptId(null);
        model.setPromptSource("template");

        log.debug("-------------model:{}", model);
        return model;
    }

    @Override
    public Essayprompt saveOrUpdatePrompt(StagePromptModel model) {
        try {
            Essayprompt entity = new Essayprompt();

            entity.setPrompt(model.getPromptText());
            entity.setCreated(Instant.now());
            entity.setId(model.getEssaypromptId());

            Essay essay = essayRepository.referenceById(model.getEssayid());
            entity.setEssayid(essay);
            entity.setPrompt(model.getPromptText());
            entity.setCreated(Instant.now());

            Stage stage = stageRepository.referenceById(model.getStageId());
            entity.setStageid(stage);

            // 儲存或更新
            if (entity.getId() == null) {
                return essaypromptService.create(entity);
            } else {
                return essaypromptService.update(entity);
            }

        } catch (Exception e) {
            log.error("儲存 Essayprompt 時發生錯誤", e);
            return null;
        }
    }

    @Override
    public Classstageprompt findById(Integer id) {
        return classstagepromptService.find(Classstageprompt.class, id);
    }
}