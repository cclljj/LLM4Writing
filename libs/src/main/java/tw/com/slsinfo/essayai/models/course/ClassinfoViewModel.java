package tw.com.slsinfo.essayai.models.course;

import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.*;
import tw.com.slsinfo.essayai.models.wicket.admin.CRoleModel;

public class ClassinfoViewModel extends SerializeModel {

    private Integer id;
    private int uid;
    private int sid;
    private String grade;
    private String sclass;
    private String seatno;
    private String classname;
    private String account;
    private String name;
    private int rid;
    private CRoleModel role;
    private SchoolModel school;
    private UserModel user;

    public ClassinfoViewModel() {
    }

    public ClassinfoViewModel(int id, String name) {
        this.id = id;
        this.name = name;
    }
    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getId() {
        return id;
    }

    public int getUid() {
        return uid;
    }

    public void setUid(int uid) {
        this.uid = uid;
    }

    public int getSid() {
        return sid;
    }

    public void setSid(int sid) {
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

    public String getClassname() {
        return classname;
    }

    public void setClassname(String classname) {
        this.classname = classname;
    }

    public String getAccount() {
        return account;
    }

    public void setAccount(String account) {
        this.account = account;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getRid() {
        return rid;
    }

    public void setRid(int rid) {
        this.rid = rid;
    }

    public SchoolModel getSchool() {
        return school;
    }

    public void setSchool(SchoolModel school) {
        this.school = school;
    }

    public UserModel getUser() {
        return user;
    }

    public void setUser(UserModel user) {
        this.user = user;
    }

    public ClassinfoViewModel(int id, int uid, int sid, String grade, String sclass, String seatno,
                              String classname, String account, String name) {
        this.id = id;
        this.uid = uid;
        this.sid = sid;
        this.grade = grade;
        this.sclass = sclass;
        this.seatno = seatno;
        this.classname = classname;
        this.account = account;
        this.name = name;
    }


    public static ClassinfoViewModel createNew(Classinfo s) {

        return new ClassinfoViewModel(s.getId(), s.getUid().getId(), s.getSid().getId(), s.getGrade(), s.getSclass(), s.getSeatno(),
                s.getClassname(), s.getUid().getUid(), s.getUid().getName());
    }

    public static ClassinfoViewModel createNew(Classgroupmember s) {

        return new ClassinfoViewModel(s.getId(), s.getMemberCid().getUid().getId(), s.getMemberCid().getSid().getId(),s.getMemberCid().getGrade(),
                s.getMemberCid().getSclass(), s.getMemberCid().getSeatno(),
                s.getMemberCid().getClassname(), s.getMemberCid().getUid().getUid(), s.getMemberCid().getUid().getName());
    }

}
