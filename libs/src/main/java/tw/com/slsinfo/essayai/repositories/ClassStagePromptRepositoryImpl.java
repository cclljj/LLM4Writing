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
@Local(IClassStagePromptRepository.class)
public class ClassStagePromptRepositoryImpl implements IClassStagePromptRepository {

    private static final Logger log = LogManager.getLogger(ClassStagePromptRepositoryImpl.class);

    @Inject
    private IRDBCrudService<Classstageprompt> classstagepromptService;

    @Inject
    private IRDBCrudService<Essayprompt> essaypromptService;

    @Inject
    private IRDBCrudService<Stage> stageService;

    @Inject
    private IStageRepository stageRepository;

    @Override
    public Classstageprompt findByOcidAndStageId(Integer ocid, Integer stageid) {
        try {
            List<Classstageprompt> results = classstagepromptService.findWithNamedQuery(
                    "Classstageprompt.findByOcidAndStageId",
                    QueryParameterBuilder.start("ocid", ocid)
                            .with("stageid", stageid)
                            .build()
            );
            return results.isEmpty() ? null : results.get(0);
        } catch (Exception e) {
            log.error("查找 Classstageprompt 時發生錯誤: ocid={}, stageid={}", ocid, stageid, e);
            return null;
        }
    }

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
    public List<StagePromptModel> getStagePromptModels(Integer ocid, Integer essayid,
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
                    StagePromptModel model = buildStagePromptModel(ocid, essayid, stage);
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
                    StagePromptModel model = buildStagePromptModel(ocid, essayid, stage);
                    models.add(model);
                }
            }
        } catch (Exception e) {
            log.error("取得 StagePromptModels 時發生錯誤", e);
        }

        return models;
    }

    @Override
    public StagePromptModel getStagePromptModel(Integer ocid, Integer essayid, Integer stageid) {
        try {
            Stage stage = stageRepository.findId(stageid);
            if (stage == null) {
                log.warn("找不到 Stage: stageid={}", stageid);
                return null;
            }

            return buildStagePromptModel(ocid, essayid, stage);

        } catch (Exception e) {
            log.error("取得 StagePromptModel 時發生錯誤: stageid={}", stageid, e);
            return null;
        }
    }

    /**
     * 建立 StagePromptModel (核心邏輯)
     */
    private StagePromptModel buildStagePromptModel(Integer ocid, Integer essayid, Stage stage) {
        StagePromptModel model = new StagePromptModel();
        log.debug("-------------buildStagePromptModel");
        // 設定 Stage 基本資訊
        model.setStageId(stage.getId());
        model.setStageName(stage.getStagename());
        model.setLlmtype(stage.getLlmtype());
        model.setChattype(stage.getChattype());
        model.setOcid(ocid);
        model.setEssayid(essayid);

        // 優先查找自訂 Prompt (Classstageprompt)
        Classstageprompt classPrompt = findByOcidAndStageId(ocid, stage.getId());

        log.debug("-------------buildStagePromptModel ocid:{}, essayid:{},stageid:{}", ocid, essayid, stage.getId());
        if (classPrompt != null) {
            // 已自訂
            model.setPromptText(classPrompt.getPrompt());
            model.setCustomized(true);
            model.setClasspromptId(classPrompt.getId());
            model.setPromptSource("customized");
        } else {
            // 使用範本
            Essayprompt essayPrompt = findEssayPromptByEssayIdAndStageId(essayid, stage.getId());
            if (essayPrompt != null) {
                model.setPromptText(essayPrompt.getPrompt());
            } else {
                model.setPromptText(""); // 無範本
            }
            model.setCustomized(false);
            model.setClasspromptId(null);
            model.setPromptSource("template");
        }
        log.debug("-------------model:{}", model);
        return model;
    }

    @Override
    public Classstageprompt saveOrUpdatePrompt(StagePromptModel model) {
        try {
            Classstageprompt entity;

            if (model.isCustomized() && model.getClasspromptId() != null) {
                // 更新現有的自訂 Prompt
                entity = findById(model.getClasspromptId());
                if (entity == null) {
                    log.error("找不到要更新的 Classstageprompt: id={}", model.getClasspromptId());
                    return null;
                }
                entity.setPrompt(model.getPromptText());
                entity.setModified(Instant.now());

            } else {
                // 新增自訂 Prompt (第一次從範本儲存)
                entity = new Classstageprompt();

                // 設定關聯
                Openclass openclass = new Openclass();
                openclass.setId(model.getOcid());
                entity.setOcid(openclass);

                Stage stage = stageRepository.referenceById(model.getStageId());
                entity.setStageid(stage);

                entity.setPrompt(model.getPromptText());
                entity.setCreated(Instant.now());
                entity.setModified(Instant.now());
            }

            // 儲存或更新
            if (entity.getId() == null) {
                return classstagepromptService.create(entity);
            } else {
                return classstagepromptService.update(entity);
            }

        } catch (Exception e) {
            log.error("儲存 Classstageprompt 時發生錯誤", e);
            return null;
        }
    }

    @Override
    public void deleteCustomPrompt(Integer classpromptId) {
        try {
            Classstageprompt entity = findById(classpromptId);
            if (entity != null) {
                classstagepromptService.delete(Classstageprompt.class, classpromptId);
                log.info("已刪除自訂 Prompt: id={}", classpromptId);
            }
        } catch (Exception e) {
            log.error("刪除 Classstageprompt 時發生錯誤: id={}", classpromptId, e);
        }
    }

    @Override
    public Classstageprompt findById(Integer id) {
        return classstagepromptService.find(Classstageprompt.class, id);
    }
}