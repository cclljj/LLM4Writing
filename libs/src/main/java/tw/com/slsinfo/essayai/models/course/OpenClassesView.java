package tw.com.slsinfo.essayai.models.course;

import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essay;
import tw.com.slsinfo.essayai.databases.mysql.entities.Openclass;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;
import tw.com.slsinfo.essayai.services.EssayService;

/**
 * 建立 臨時帳號
 */
public class OpenClassesView extends SerializeModel {

    private Integer id;
    private String classname;
    private Integer discussiontime;
    private String supplementarytxt;
    private String enable;
    private Integer eid;
    private Integer gid;
    private String title;
    private String genre;
    private EssayViewModel essay;
    private School sid;
    private String llmtype;

    // 統計資訊
    private Integer groupCount;
    private Integer memberCount;

    public OpenClassesView() {
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getClassname() {
        return classname;
    }

    public void setClassname(String classname) {
        this.classname = classname;
    }

    public Integer getDiscussiontime() {
        return discussiontime;
    }

    public void setDiscussiontime(Integer discussiontime) {
        this.discussiontime = discussiontime;
    }

    public String getSupplementarytxt() {
        return supplementarytxt;
    }

    public void setSupplementary_txt(String supplementarytxt) {
        this.supplementarytxt = supplementarytxt;
    }

    public String getEnable() {
        return enable;
    }

    public void setEnable(String enable) {
        this.enable = enable;
    }

    public Integer getEid() {
        return eid;
    }

    public void setEid(Integer eid) {
        this.eid = eid;
    }

    public Integer getGid() {
        return gid;
    }

    public void setGid(Integer gid) {
        this.gid = gid;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getGenre() {
        return genre;
    }

    public void setGenre(String genre) {
        this.genre = genre;
    }

    public EssayViewModel getEssay() {
        return essay;
    }

    public void setEssay(EssayViewModel essay) {
        this.essay = essay;
    }

    public School getSid() {
        return sid;
    }

    public void setSid(School sid) {
        this.sid = sid;
    }

    public String getLlmtype() {
        return llmtype;
    }

    public void setLlmtype(String llmtype) {
        this.llmtype = llmtype;
    }

    public void setSupplementarytxt(String supplementarytxt) {
        this.supplementarytxt = supplementarytxt;
    }

    public static OpenClassesView createNew(Openclass model, Essay essay) {
        OpenClassesView view = new OpenClassesView();
        view.setId(model.getId());
        view.setClassname(model.getClassname());
        view.setDiscussiontime(model.getDiscussiontime());
        view.setSupplementary_txt(model.getSupplementarytxt());
        view.setEnable(model.getEnable());
        view.setSid(model.getSid());
        view.setLlmtype(model.getLlmtype());
        if (essay != null) view.setEid(essay.getId());
        if (essay != null) view.setGid(essay.getGid().getId());
        if (essay != null) view.setTitle(essay.getTitle());
        if (essay != null) view.setGenre(essay.getGid().getGenre());
        if (essay != null) view.setEssay(EssayViewModel.createNew(essay));
        return view;
    }

    /**
     * 檢查是否有分組
     *
     * @return 是否有分組
     */
    public boolean hasGroups() {
        return groupCount != null && groupCount > 0;
    }

    /**
     * 取得分組統計描述
     *
     * @return 分組統計描述
     */
    public String getGroupStatistics() {
        if (!hasGroups()) {
            return "尚無分組";
        }
        return String.format("%d 組，共 %d 人", groupCount, memberCount != null ? memberCount : 0);
    }
}
