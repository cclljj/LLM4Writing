package tw.com.slsinfo.essayai.models.course;

import java.io.Serializable;

public class StagePromptModel implements Serializable {

    private Integer stageId;
    private String stageName;
    private String llmtype;
    private String chattype;

    // Prompt 相關
    private String promptText;
    private boolean isCustomized; // 是否已自訂 (存在於 Classstageprompt)
    private Integer classpromptId; // Classstageprompt 的 ID (如果已自訂)
    private String promptSource; // "template" 或 "customized"

    private Integer essaypromptId; // Essay 的 ID

    // 用於儲存
    private Integer ocid;
    private Integer essayid;

    public StagePromptModel() {
    }

    public StagePromptModel(Integer stageId, String stageName) {
        this.stageId = stageId;
        this.stageName = stageName;
        this.isCustomized = false;
        this.promptSource = "template";
    }

    // Getters and Setters

    public Integer getStageId() {
        return stageId;
    }

    public void setStageId(Integer stageId) {
        this.stageId = stageId;
    }

    public String getStageName() {
        return stageName;
    }

    public void setStageName(String stageName) {
        this.stageName = stageName;
    }

    public String getLlmtype() {
        return llmtype;
    }

    public void setLlmtype(String llmtype) {
        this.llmtype = llmtype;
    }

    public String getChattype() {
        return chattype;
    }

    public void setChattype(String chattype) {
        this.chattype = chattype;
    }

    public String getPromptText() {
        return promptText;
    }

    public void setPromptText(String promptText) {
        this.promptText = promptText;
    }

    public boolean isCustomized() {
        return isCustomized;
    }

    public void setCustomized(boolean customized) {
        isCustomized = customized;
    }

    public Integer getEssaypromptId() {
        return essaypromptId;
    }

    public void setEssaypromptId(Integer essaypromptId) {
        this.essaypromptId = essaypromptId;
    }

    public Integer getClasspromptId() {
        return classpromptId;
    }

    public void setClasspromptId(Integer classpromptId) {
        this.classpromptId = classpromptId;
    }

    public String getPromptSource() {
        return promptSource;
    }

    public void setPromptSource(String promptSource) {
        this.promptSource = promptSource;
    }

    public Integer getOcid() {
        return ocid;
    }

    public void setOcid(Integer ocid) {
        this.ocid = ocid;
    }

    public Integer getEssayid() {
        return essayid;
    }

    public void setEssayid(Integer essayid) {
        this.essayid = essayid;
    }

    /**
     * 取得狀態顯示文字
     */
    public String getStatusText() {
        return isCustomized ? "已自訂" : "使用範本";
    }

    /**
     * 取得狀態樣式 class
     */
    public String getStatusClass() {
        return isCustomized ? "badge bg-success" : "badge bg-secondary";
    }

    @Override
    public String toString() {
        return "StagePromptModel{" +
                "stageId=" + stageId +
                ", stageName='" + stageName + '\'' +
                ", llmtype='" + llmtype + '\'' +
                ", chattype='" + chattype + '\'' +
                ", promptText='" + promptText + '\'' +
                ", isCustomized=" + isCustomized +
                ", classpromptId=" + classpromptId +
                ", promptSource='" + promptSource + '\'' +
                ", essaypromptId=" + essaypromptId +
                ", ocid=" + ocid +
                ", essayid=" + essayid +
                '}';
    }
}