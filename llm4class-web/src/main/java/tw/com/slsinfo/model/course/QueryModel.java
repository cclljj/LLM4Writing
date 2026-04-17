package tw.com.slsinfo.model.course;

import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.models.SelectOption;
import tw.com.slsinfo.essayai.models.course.EssayViewModel;
import tw.com.slsinfo.essayai.models.course.OpenClassesView;

/**
 * info.sls.school form model
 */
public class QueryModel extends SerializeModel {

    private OpenClassesView classname;
    private EssayViewModel essay;
    private Integer sid;
    private SelectOption enable;

    public QueryModel() {
    }

    public EssayViewModel getEssay() {
        return essay;
    }

    public void setEssay(EssayViewModel essay) {
        this.essay = essay;
    }

    public OpenClassesView getClassname() {
        return classname;
    }

    public void setClassname(OpenClassesView classname) {
        this.classname = classname;
    }

    public Integer getSid() {
        return sid;
    }

    public void setSid(Integer sid) {
        this.sid = sid;
    }

    public SelectOption getEnable() {
        return enable;
    }

    public void setEnable(SelectOption enable) {
        this.enable = enable;
    }
}
