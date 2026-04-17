package tw.com.slsinfo.essayai.models.course;

import java.io.Serializable;

public class ClassGroupStatisticsModel  implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer ocid;
    private int totalGroups;
    private int totalMembers;
    private double averageSize;
    private int maxGroupSize;
    private int minGroupSize;
    private boolean balanced;

    // 預設建構子
    public ClassGroupStatisticsModel() {}

    // 帶參數建構子
    public ClassGroupStatisticsModel(Integer ocid) {
        this.ocid = ocid;
    }

    /**
     * 取得統計描述
     * @return 統計描述字串
     */
    public String getDescription() {
        if (totalGroups == 0) {
            return "尚無分組資料";
        }

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("共 %d 組，%d 名成員", totalGroups, totalMembers));

        if (totalGroups > 0) {
            sb.append(String.format("，平均每組 %.1f 人", averageSize));
            if (maxGroupSize != minGroupSize) {
                sb.append(String.format("（%d-%d人）", minGroupSize, maxGroupSize));
            }
            if (balanced) {
                sb.append(" [平衡]");
            }
        }

        return sb.toString();
    }

    /**
     * 檢查是否有資料
     * @return 是否有資料
     */
    public boolean hasData() {
        return totalGroups > 0;
    }

    // Getters and Setters
    public Integer getOcid() { return ocid; }
    public void setOcid(Integer ocid) { this.ocid = ocid; }

    public int getTotalGroups() { return totalGroups; }
    public void setTotalGroups(int totalGroups) { this.totalGroups = totalGroups; }

    public int getTotalMembers() { return totalMembers; }
    public void setTotalMembers(int totalMembers) { this.totalMembers = totalMembers; }

    public double getAverageSize() { return averageSize; }
    public void setAverageSize(double averageSize) { this.averageSize = averageSize; }

    public int getMaxGroupSize() { return maxGroupSize; }
    public void setMaxGroupSize(int maxGroupSize) { this.maxGroupSize = maxGroupSize; }

    public int getMinGroupSize() { return minGroupSize; }
    public void setMinGroupSize(int minGroupSize) { this.minGroupSize = minGroupSize; }

    public boolean isBalanced() { return balanced; }
    public void setBalanced(boolean balanced) { this.balanced = balanced; }

    @Override
    public String toString() {
        return String.format("ClassGroupStatistics{ocid=%d, totalGroups=%d, totalMembers=%d, averageSize=%.1f, balanced=%b}",
                ocid, totalGroups, totalMembers, averageSize, balanced);
    }
}