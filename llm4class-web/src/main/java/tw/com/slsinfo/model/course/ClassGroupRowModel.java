package tw.com.slsinfo.model.course;

import tw.com.slsinfo.essayai.models.course.ClassinfoViewModel;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 分組列模型
 */
public class ClassGroupRowModel implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer id;
    private String groupName;
    private List<ClassinfoViewModel> selectedMembers;

    public ClassGroupRowModel() {
        this.selectedMembers = new ArrayList<>();
    }

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
        this.selectedMembers = selectedMembers;
    }

}
