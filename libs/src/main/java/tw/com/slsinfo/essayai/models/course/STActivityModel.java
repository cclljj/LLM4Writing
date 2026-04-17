package tw.com.slsinfo.essayai.models.course;

import tw.com.slsinfo.commons.io.SerializeModel;

import java.util.List;

/**
 * Student Activity List Provider Model
 */
public class STActivityModel extends SerializeModel {
    private Integer id;
    private Integer ocid;
    private String groupname;
    private String classname;
    private Integer cgid;
    private Integer membercid;
    // 新增直接儲存需要顯示的欄位，避免關聯物件
    private String title;  // 直接儲存 title
    private int essayid;
    private int genreid;
    private String memberlist;
    private String isend;

    public STActivityModel() {
    }


    public String getClassname() {
        return classname;
    }

    public STActivityModel setClassname(String classname) {
        this.classname = classname;
        return this;
    }

    public String getTitle() {
        return title;
    }

    public STActivityModel setTitle(String title) {
        this.title = title;
        return this;
    }

    public int getEssayid() {
        return essayid;
    }

    public void setEssayid(int essayid) {
        this.essayid = essayid;
    }

    public int getGenreid() {
        return genreid;
    }

    public STActivityModel setGenreid(int genreid) {
        this.genreid = genreid;
        return this;
    }

    public Integer getCgid() {
        return cgid;
    }

    public STActivityModel setCgid(Integer cgid) {
        this.cgid = cgid;
        return this;
    }

    public String getGroupname() {
        return groupname;
    }

    public STActivityModel setGroupname(String groupname) {
        this.groupname = groupname;
        return this;
    }

    public Integer getId() {
        return id;
    }

    public STActivityModel setId(Integer id) {
        this.id = id;
        return this;
    }

    public Integer getMembercid() {
        return membercid;
    }

    public STActivityModel setMembercid(Integer membercid) {
        this.membercid = membercid;
        return this;
    }

    public Integer getOcid() {
        return ocid;
    }

    public STActivityModel setOcid(Integer ocid) {
        this.ocid = ocid;
        return this;
    }

    public String getMemberlist() {
        return memberlist;
    }

    public void setMemberlist(String memberlist) {
        this.memberlist = memberlist;
    }

    public String getIsend() {
        return isend;
    }

    public void setIsend(String isend) {
        this.isend = isend;
    }
}
