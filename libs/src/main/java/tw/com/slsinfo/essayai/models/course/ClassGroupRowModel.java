package tw.com.slsinfo.essayai.models.course;
import tw.com.slsinfo.essayai.models.course.ClassinfoViewModel;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class ClassGroupRowModel  implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer id;
    private String groupName;
    private List<ClassinfoViewModel> selectedMembers;

    // 預設建構子
    public ClassGroupRowModel() {
        this.selectedMembers = new ArrayList<>();
    }

    // 帶參數建構子
    public ClassGroupRowModel(String groupName) {
        this();
        this.groupName = groupName;
    }

    public ClassGroupRowModel(Integer id, String groupName) {
        this();
        this.id = id;
        this.groupName = groupName;
    }

    /**
     * 新增成員
     * @param member 成員
     */
    public void addMember(ClassinfoViewModel member) {
        if (member != null && !selectedMembers.contains(member)) {
            selectedMembers.add(member);
        }
    }

    /**
     * 移除成員
     * @param member 成員
     */
    public void removeMember(ClassinfoViewModel member) {
        selectedMembers.remove(member);
    }

    /**
     * 清空所有成員
     */
    public void clearMembers() {
        selectedMembers.clear();
    }

    /**
     * 檢查是否有成員
     * @return 是否有成員
     */
    public boolean hasMembers() {
        return selectedMembers != null && !selectedMembers.isEmpty();
    }

    /**
     * 取得成員數量
     * @return 成員數量
     */
    public int getMemberCount() {
        return selectedMembers != null ? selectedMembers.size() : 0;
    }

    /**
     * 檢查是否包含指定成員
     * @param member 成員
     * @return 是否包含
     */
    public boolean containsMember(ClassinfoViewModel member) {
        return selectedMembers != null && selectedMembers.contains(member);
    }

    // Getters and Setters
    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getGroupName() {
        return groupName;
    }

    public void setGroupName(String groupName) {
        this.groupName = groupName;
    }

    public List<ClassinfoViewModel> getSelectedMembers() {
        return selectedMembers;
    }

    public void setSelectedMembers(List<ClassinfoViewModel> selectedMembers) {
        this.selectedMembers = selectedMembers != null ? selectedMembers : new ArrayList<>();
    }

    @Override
    public String toString() {
        return String.format("ClassGroupRowModel{id=%d, groupName='%s', memberCount=%d}",
                id, groupName, getMemberCount());
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        ClassGroupRowModel that = (ClassGroupRowModel) o;

        if (id != null ? !id.equals(that.id) : that.id != null) return false;
        return groupName != null ? groupName.equals(that.groupName) : that.groupName == null;
    }

    @Override
    public int hashCode() {
        int result = id != null ? id.hashCode() : 0;
        result = 31 * result + (groupName != null ? groupName.hashCode() : 0);
        return result;
    }
}
