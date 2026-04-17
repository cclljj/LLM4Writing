package tw.com.slsinfo.essayai.services;

import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classstageprompt;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essayprompt;
import tw.com.slsinfo.essayai.models.course.StagePromptModel;
import tw.com.slsinfo.essayai.repositories.IClassStagePromptRepository;
import tw.com.slsinfo.essayai.repositories.IEssayPromptRepository;

import java.util.List;

@Stateless
public class EssayPromptService {

        private static final Logger logger = LogManager.getLogger(EssayPromptService.class);

        @Inject
        private IEssayPromptRepository promptRepository;

        public List<StagePromptModel> getStagePromptModels( Integer essayid,
                                                           String llmtype, String chattype) {
            try {
                logger.debug("Getting stage prompt models -  essayid: {}, llmtype: {}, chattype: {}",
                         essayid, llmtype, chattype);

                List<StagePromptModel> models = promptRepository.getStagePromptModels(
                         essayid, llmtype, chattype
                );

                logger.debug("-------------------Successfully retrieved {} stage prompt models", models.size());
                return models;

            } catch (Exception e) {
                logger.debug("--------------------Error getting stage prompt models - ocid: {}, essayid: {}",
                        essayid, e);
                throw new RuntimeException("取得階段 Prompt 資料失敗", e);
            }
        }

        public StagePromptModel getStagePromptModel( Integer essayid, Integer stageid) {
            try {
                logger.debug("Getting stage prompt model - ocid: {}, essayid: {}, stageid: {}",
                         essayid, stageid);

                StagePromptModel model = promptRepository.getStagePromptModel(essayid, stageid);

                if (model != null) {
                    logger.debug("Successfully retrieved stage prompt model for stage: {}", stageid);
                } else {
                    logger.warn("Stage prompt model not found for stage: {}", stageid);
                }

                return model;

            } catch (Exception e) {
                logger.debug("Error getting stage prompt model - stageid: {}", stageid, e);
                throw new RuntimeException("取得階段 Prompt 資料失敗", e);
            }
        }

        public boolean saveOrUpdatePrompt(StagePromptModel model) {
            try {
                // 驗證必要參數
                if (model == null) {
                    logger.warn("Cannot save prompt - model is null");
                    return false;
                }

                if ( model.getStageId() == null) {
                    logger.warn("Cannot save prompt - missing required data: stageId={}",
                             model.getStageId());
                    return false;
                }

                logger.debug("Saving prompt - stageId: {}, customized: {}",
                        model.getStageId(), model.isCustomized());

                Essayprompt saved = promptRepository.saveOrUpdatePrompt(model);

                if (saved != null) {
                    logger.debug("Successfully saved prompt - id: {}, stageId: {}",
                            saved.getId(), model.getStageId());

                    // 更新 model 的狀態
                    model.setCustomized(true);
                    model.setClasspromptId(saved.getId());
                    model.setPromptSource("customized");

                    return true;
                } else {
                    logger.debug("Failed to save prompt - returned null");
                    return false;
                }

            } catch (Exception e) {
                logger.debug("Error saving prompt - stageId: {}",
                         model.getStageId(), e);
                return false;
            }
        }

        public Classstageprompt findById(Integer id) {
            try {
                logger.debug("Finding classstageprompt by id: {}", id);

                Classstageprompt result = promptRepository.findById(id);

                if (result != null) {
                    logger.debug("Found classstageprompt - id: {}", id);
                } else {
                    logger.warn("Classstageprompt not found - id: {}", id);
                }

                return result;

            } catch (Exception e) {
                logger.debug("Error finding classstageprompt - id: {}", id, e);
                return null;
            }
        }

        public int batchSavePrompts(List<StagePromptModel> models) {
            int successCount = 0;
            int failCount = 0;

            if (models == null || models.isEmpty()) {
                logger.warn("Cannot batch save - models list is null or empty");
                return 0;
            }

            logger.debug("Starting batch save - total: {}", models.size());

            for (StagePromptModel model : models) {
                try {
                    boolean success = saveOrUpdatePrompt(model);
                    if (success) {
                        successCount++;
                    } else {
                        failCount++;
                        logger.warn("Failed to save prompt in batch - stageId: {}", model.getStageId());
                    }
                } catch (Exception e) {
                    failCount++;
                    logger.debug("Error saving prompt in batch - stageId: {}", model.getStageId(), e);
                }
            }

            logger.debug("Batch save completed - success: {}, failed: {}, total: {}",
                    successCount, failCount, models.size());

            return successCount;
        }
    }