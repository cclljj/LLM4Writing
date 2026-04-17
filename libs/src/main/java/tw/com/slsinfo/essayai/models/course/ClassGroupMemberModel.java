package tw.com.slsinfo.essayai.models.course;

import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.validation.constraints.NotNull;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroup;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroupmember;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class ClassGroupMemberModel implements Serializable {
    private static final long serialVersionUID = 1L;
    private static final Logger logger = LogManager.getLogger(ClassGroupMemberModel.class);

    private Integer id;
    private Integer ocid;
    private String groupname;
    private Integer cgid;
    private Integer membercid;
    private String classname;

    private ClassGroupModel classgroup;
    private ClassInfoModel classinfo;

    // 新增直接儲存需要顯示的欄位，避免關聯物件
    private String title;  // 直接儲存 title
    private String cname;  // 直接儲存 title


    public ClassGroupMemberModel() {

    }

    public String getClassname() {
        return classname;
    }

    public ClassGroupMemberModel setClassname(String classname) {
        this.classname = classname;
        return this;
    }

    // Getters and Setters
    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getOcid() {
        return ocid;
    }

    public void setOcid(Integer ocid) {
        this.ocid = ocid;
    }

    public String getGroupname() {
        return groupname;
    }

    public void setGroupname(String groupname) {
        this.groupname = groupname;
    }


    public Integer getMembercid() {
        return membercid;
    }

    public void setMembercid(Integer membercid) {
        this.membercid = membercid;
    }

    public Integer getCgid() {
        return cgid;
    }

    public void setCgid(Integer cgid) {
        this.cgid = cgid;
    }

    public ClassGroupModel getClassgroup() {
        return classgroup;
    }

    public void setClassgroup(ClassGroupModel classgroup) {
        this.classgroup = classgroup;
    }

    public ClassInfoModel getClassinfo() {
        return classinfo;
    }

    public void setClassinfo(ClassInfoModel classinfo) {
        this.classinfo = classinfo;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public ClassGroupMemberModel(Classgroup classgroup) {
        this.id = id;
        this.ocid = classgroup.getOcid().getId();
        this.groupname = classgroup.getGroupname();
        // 在這裡就取得需要的值，避免在 UI 層存取
        this.title = classgroup.getOcid().getEid().getTitle();
    }

    public ClassGroupMemberModel(Classgroupmember m) {
        this.id = m.getId();
        this.cgid = m.getCgid().getId();
        this.ocid = m.getCgid().getOcid().getId();
        this.membercid = m.getMemberCid().getId();
        this.cname = m.getMemberCid().getUid().getName();
    }

    public static ClassGroupMemberModel createNew(Classgroupmember classgroupmember) {
        ClassGroupMemberModel model = new ClassGroupMemberModel(classgroupmember);
        return model;
    }

    public static ClassGroupMemberModel createNew(Classgroup classgroup) {
        ClassGroupMemberModel model = new ClassGroupMemberModel(classgroup);
        return model;
    }

    public String getCname() {
        return cname;
    }

    public void setCname(String cname) {
        this.cname = cname;
    }
}