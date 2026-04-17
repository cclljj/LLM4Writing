package tw.com.slsinfo.essayai.models.course;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;

/**
 * 建立 臨時帳號
 */
public class OpenClassModel extends SerializeModel {

    private EssayViewModel essay;
    private School sid;

    @NotEmpty(message = "班級名稱不得為空")
    @Size(max = 40, message = "班級名稱長度不得超過40字元")
    private String classname;

    private int discussiontime;
    private String supplementarytxt;
    private String enable;
    private int Createduid;
    private int Modifieduid;
    private int id;
    private String llmtype;

    public OpenClassModel() {
    }

    public OpenClassModel setId(int id) {
        this.id = id;
        return this;
    }

    public int getId() {
        return id;
    }

    public @NotEmpty(message = "小組討論名稱不得為空") @Size(max = 40, message = "小組討論名稱長度不得超過40字元") String getClassname() {
        return classname;
    }

    public OpenClassModel setClassname(@NotEmpty(message = "小組討論名稱不得為空") @Size(max = 40, message = "小組討論名稱長度不得超過40字元") String classname) {
        this.classname = classname;
        return this;
    }

    public EssayViewModel getEssay() {
        return essay;
    }

    public OpenClassModel setEssay(EssayViewModel essay) {
        this.essay = essay;
        return this;
    }

    public int getDiscussiontime() {
        return discussiontime;
    }

    public void setDiscussiontime(int discussiontime) {
        this.discussiontime = discussiontime;
    }

    public String getSupplementarytxt() {
        return supplementarytxt;
    }

    public OpenClassModel setSupplementary_txt(String supplementarytxt) {
        this.supplementarytxt = supplementarytxt;
        return this;
    }

    public String getEnable() {
        return enable;
    }

    public OpenClassModel setEnable(String enable) {
        this.enable = enable;
        return this;
    }

    public School getSid() {
        return sid;
    }

    public void setSid(School sid) {
        this.sid = sid;
    }

    public int getModifieduid() {
        return Modifieduid;
    }

    public void setModifieduid(int modifieduid) {
        Modifieduid = modifieduid;
    }

    public int getCreateduid() {
        return Createduid;
    }

    public void setCreateduid(int createduid) {
        Createduid = createduid;
    }

    public void setSupplementarytxt(String supplementarytxt) {
        this.supplementarytxt = supplementarytxt;
    }

    public String getLlmtype() {
        return llmtype;
    }

    public void setLlmtype(String llmtype) {
        this.llmtype = llmtype;
    }
}
