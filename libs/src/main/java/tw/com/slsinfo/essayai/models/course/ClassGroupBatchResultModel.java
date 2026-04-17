package tw.com.slsinfo.essayai.models.course;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class ClassGroupBatchResultModel  implements Serializable {
    private static final long serialVersionUID = 1L;

    private boolean success;
    private String message;
    private Integer ocid;
    private int processedGroupCount;
    private int processedMemberCount;
    private List<String> errorMessages;
    private List<ClassGroupModel> savedGroups;

    // 預設建構子
    public ClassGroupBatchResultModel() {
        this.errorMessages = new ArrayList<>();
        this.savedGroups = new ArrayList<>();
    }

    // 成功結果建構子
    public ClassGroupBatchResultModel(Integer ocid, List<ClassGroupModel> savedGroups) {
        this();
        this.success = true;
        this.ocid = ocid;
        this.savedGroups = savedGroups;
        this.processedGroupCount = savedGroups.size();
        this.processedMemberCount = savedGroups.stream().mapToInt(ClassGroupModel::getMemberCount).sum();
        this.message = String.format("成功處理 %d 個分組，共 %d 名成員", processedGroupCount, processedMemberCount);
    }

    // 失敗結果建構子
    public ClassGroupBatchResultModel(String errorMessage) {
        this();
        this.success = false;
        this.message = errorMessage;
        this.errorMessages.add(errorMessage);
    }

    /**
     * 新增錯誤訊息
     * @param errorMessage 錯誤訊息
     */
    public void addErrorMessage(String errorMessage) {
        if (errorMessage != null && !errorMessage.trim().isEmpty()) {
            this.errorMessages.add(errorMessage);
            this.success = false;
        }
    }

    /**
     * 檢查是否有錯誤
     * @return 是否有錯誤
     */
    public boolean hasErrors() {
        return errorMessages != null && !errorMessages.isEmpty();
    }

    // Getters and Setters
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Integer getOcid() { return ocid; }
    public void setOcid(Integer ocid) { this.ocid = ocid; }

    public int getProcessedGroupCount() { return processedGroupCount; }
    public void setProcessedGroupCount(int processedGroupCount) { this.processedGroupCount = processedGroupCount; }

    public int getProcessedMemberCount() { return processedMemberCount; }
    public void setProcessedMemberCount(int processedMemberCount) { this.processedMemberCount = processedMemberCount; }

    public List<String> getErrorMessages() { return errorMessages; }
    public void setErrorMessages(List<String> errorMessages) { this.errorMessages = errorMessages; }

    public List<ClassGroupModel> getSavedGroups() { return savedGroups; }
    public void setSavedGroups(List<ClassGroupModel> savedGroups) { this.savedGroups = savedGroups; }

    @Override
    public String toString() {
        return String.format("ClassGroupBatchResult{success=%b, message='%s', processedGroupCount=%d, processedMemberCount=%d}",
                success, message, processedGroupCount, processedMemberCount);
    }
}