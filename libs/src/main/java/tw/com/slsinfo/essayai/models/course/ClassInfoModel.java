package tw.com.slsinfo.essayai.models.course;

import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;
import tw.com.slsinfo.essayai.services.SchoolService;
import tw.com.slsinfo.essayai.services.UserAccountService;

import java.io.Serializable;

public class ClassInfoModel implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer id;
    private Integer uid;
    private Integer sid;
    private String grade;
    private String sclass;
    private String seatno;
    private String sno;
    private String classname;

    public ClassInfoModel() {
    }

    // Getters and Setters
    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getUid() {
        return uid;
    }

    public void setUid(Integer uid) {
        this.uid = uid;
    }

    public Integer getSid() {
        return sid;
    }

    public void setSid(Integer sid) {
        this.sid = sid;
    }

    public String getGrade() {
        return grade;
    }

    public void setGrade(String grade) {
        this.grade = grade;
    }

    public String getSclass() {
        return sclass;
    }

    public void setSclass(String sclass) {
        this.sclass = sclass;
    }

    public String getSeatno() {
        return seatno;
    }

    public void setSeatno(String seatno) {
        this.seatno = seatno;
    }

    public String getSno() {
        return sno;
    }

    public void setSno(String sno) {
        this.sno = sno;
    }

    public String getClassname() {
        return classname;
    }

    public void setClassname(String classname) {
        this.classname = classname;
    }

    /**
     * 轉換 Entity 為 Model
     */
    public Classinfo convertToEntity(ClassInfoModel model) {
        Classinfo entity = new Classinfo();
        entity.setId(model.getId());
        entity.setUid(new UserAccountService().getUser(model.getUid()));
        entity.setSid(new SchoolService().getSchoolBySId(model.getSid()));
        entity.setGrade(model.getGrade());
        entity.setSclass(model.getSclass());
        entity.setSeatno(model.getSeatno());
        entity.setSno(model.getSno());
        entity.setClassname(model.getClassname());
//        model.setCreated(entity.getCreated());
//        model.setModified(entity.getModified());
        return entity;
    }

    public ClassInfoModel convertToEntity(Classinfo model) {
        ClassInfoModel entity = new ClassInfoModel();
        entity.setId(model.getId());
        entity.setUid(model.getUid().getId());
        entity.setSid(model.getSid().getId());
        entity.setGrade(model.getGrade());
        entity.setSclass(model.getSclass());
        entity.setSeatno(model.getSeatno());
        entity.setSno(model.getSno());
        entity.setClassname(model.getClassname());
        model.setCreated(model.getCreated());
        model.setModified(model.getModified());
        return entity;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;

        ClassInfoModel that = (ClassInfoModel) o;
        return id != null ? id.equals(that.id) : that.id == null;
    }

    @Override
    public int hashCode() {
        return id != null ? id.hashCode() : 0;
    }

    @Override
    public String toString() {
        return "ClassInfoModel{" +
                "id=" + id +
                ", sno='" + sno + '\'' +
                ", classname='" + classname + '\'' +
                '}';
    }
}
