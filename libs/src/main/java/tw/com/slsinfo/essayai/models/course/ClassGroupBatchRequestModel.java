package tw.com.slsinfo.essayai.models.course;

import java.io.Serializable;
import java.util.List;

public class ClassGroupBatchRequestModel implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer ocid;
    private List<ClassGroupModel> groups;
    private boolean replaceExisting; // 是否取代現有分組

    // 預設建構子
    public ClassGroupBatchRequestModel() {
    }

    // 帶參數建構子
    public ClassGroupBatchRequestModel(Integer ocid, List<ClassGroupModel> groups) {
        this.ocid = ocid;
        this.groups = groups;
        this.replaceExisting = true; // 預設為取代
    }

    public ClassGroupBatchRequestModel(Integer ocid, List<ClassGroupModel> groups, boolean replaceExisting) {
        this.ocid = ocid;
        this.groups = groups;
        this.replaceExisting = replaceExisting;
    }

    /**
     * 驗證請求是否有效
     *
     * @return 是否有效
     */
    public boolean isValid() {
        return ocid != null && groups != null && !groups.isEmpty();
    }

    /**
     * 取得分組總數
     *
     * @return 分組總數
     */
    public int getGroupCount() {
        return groups != null ? groups.size() : 0;
    }

    /**
     * 取得總成員數
     *
     * @return 總成員數
     */
    public int getTotalMemberCount() {
        if (groups == null) return 0;
        return groups.stream().mapToInt(ClassGroupModel::getMemberCount).sum();
    }

    // Getters and Setters
    public Integer getOcid() {
        return ocid;
    }

    public void setOcid(Integer ocid) {
        this.ocid = ocid;
    }

    public List<ClassGroupModel> getGroups() {
        return groups;
    }

    public void setGroups(List<ClassGroupModel> groups) {
        this.groups = groups;
    }

    public boolean isReplaceExisting() {
        return replaceExisting;
    }

    public void setReplaceExisting(boolean replaceExisting) {
        this.replaceExisting = replaceExisting;
    }

    @Override
    public String toString() {
        return String.format("ClassGroupBatchRequestModel{ocid=%d, groupCount=%d, totalMemberCount=%d, replaceExisting=%b}",
                ocid, getGroupCount(), getTotalMemberCount(), replaceExisting);
    }
}