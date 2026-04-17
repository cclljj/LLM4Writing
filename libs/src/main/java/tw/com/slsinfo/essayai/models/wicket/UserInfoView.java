package tw.com.slsinfo.essayai.models.wicket;

import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.essayai.models.wicket.school.SchoolInfoView;

/**
 * 使用者基本內容
 */
public class UserInfoView extends SerializeModel {


    /**
     * table user's primary key
     */
    private int user_id;
    /**
     * 使用者姓名
     */
    private String truename;


    /**
     * 帳號
     */
    private String uid;


    /**
     * 信箱
     */
    private String email;


    /**
     * table school's  primary key
     */
    private int school_id;

    /**
     * 學校代碼
     */
    private String schoolid;

    /**
     * 學校名稱
     */
    private String schoolname;


    public UserInfoView() {
    }

    public UserInfoView(String truename, String uid, String email) {
        this.truename = truename;
        this.uid = uid;
        this.email = email;
    }

    public UserInfoView(int user_id, String truename, String uid, String email, int school_id, String schoolid, String schoolname) {
        this.user_id = user_id;
        this.truename = truename;
        this.uid = uid;
        this.email = email;
        this.school_id = school_id;
        this.schoolid = schoolid;
        this.schoolname = schoolname;
    }

    public static UserInfoView createNew(User u, SchoolInfoView school) {
        return new UserInfoView(u.getId(), u.getName(), u.getUid(), u.getEmail(), school.getId(), school.getSchoolid(), school.getSchoolname());
    }

    public static UserInfoView createNew(User u) {
        return new UserInfoView(u.getId(), u.getName(), u.getUid(), u.getEmail());
    }

    public UserInfoView(int user_id, String truename, String uid, String email) {
        this.user_id = user_id;
        this.truename = truename;
        this.uid = uid;
        this.email = email;
    }

    public String getUsername() {
        return truename;
    }

    public void setUsername(String username) {
        this.truename = username;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }


    public String getSchoolid() {
        return schoolid;
    }

    public void setSchoolid(String schoolid) {
        this.schoolid = schoolid;
    }

    public String getSchoolname() {
        return schoolname;
    }

    public void setSchoolname(String schoolname) {
        this.schoolname = schoolname;
    }

    public int getUser_id() {
        return user_id;
    }

    public void setUser_id(int user_id) {
        this.user_id = user_id;
    }

    public int getSchool_id() {
        return school_id;
    }

    public void setSchool_id(int school_id) {
        this.school_id = school_id;
    }
}
