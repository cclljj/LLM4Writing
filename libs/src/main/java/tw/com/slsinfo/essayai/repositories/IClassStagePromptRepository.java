package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classstageprompt;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essayprompt;
import tw.com.slsinfo.essayai.models.course.StagePromptModel;

import java.util.List;

@Local
public interface IClassStagePromptRepository {

    /**
     * 根據 ocid 和 stageid 查找 Classstageprompt
     */
    Classstageprompt findByOcidAndStageId(Integer ocid, Integer stageid);

    /**
     * 根據 essayid 和 stageid 查找 Essayprompt (範本)
     */
    Essayprompt findEssayPromptByEssayIdAndStageId(Integer essayid, Integer stageid);

    /**
     * 取得所有 Stage 的 Prompt 資料 (整合 Classstageprompt 和 Essayprompt)
     *
     * @param ocid 開課 ID
     * @param essayid 作文範本 ID
     * @param llmtype LLM 類型
     * @param chattype 對話類型
     * @return StagePromptModel 列表
     */
    List<StagePromptModel> getStagePromptModels(Integer ocid, Integer essayid,
                                                String llmtype, String chattype);

    /**
     * 取得單一 Stage 的 Prompt Model
     */
    StagePromptModel getStagePromptModel(Integer ocid, Integer essayid, Integer stageid);

    /**
     * 儲存或更新 Classstageprompt
     * 如果是第一次儲存,會從 Essayprompt 複製範本
     */
    Classstageprompt saveOrUpdatePrompt(StagePromptModel model);

    /**
     * 刪除自訂 Prompt (恢復使用範本)
     */
    void deleteCustomPrompt(Integer classpromptId);

    /**
     * 根據 ID 查找 Classstageprompt
     */
    Classstageprompt findById(Integer id);
}
