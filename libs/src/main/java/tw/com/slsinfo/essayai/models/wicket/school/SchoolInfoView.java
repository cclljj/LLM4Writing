package tw.com.slsinfo.essayai.models.wicket.school;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;
import tw.com.slsinfo.commons.io.SerializeModel;

public class SchoolInfoView extends SerializeModel {

    private int id;

    @NotEmpty(message = "學校名稱不得為空")
    @Size(max = 60, message = "學校名稱長度不能超過60字元")
    private String schoolname;

    @NotEmpty(message = "學校代碼不得為空")
    @Size(max = 10, message = "學校代碼長度不能超過10字元")
    private String schoolid;


    public SchoolInfoView() {
    }

    public SchoolInfoView(int id, String schoolname, String schoolid) {
        this.id = id;
        this.schoolname = schoolname;
        this.schoolid = schoolid;
    }


    public static SchoolInfoView createNew(School s) {
        return new SchoolInfoView(s.getId(), s.getFname(), s.getSid());
    }

    public int getId() {
        return id;
    }

    public SchoolInfoView setId(int id) {
        this.id = id;
        return this;
    }

    public @NotEmpty(message = "學校名稱不得為空") @Size(max = 60, message = "學校名稱長度不能超過60字元") String getSchoolname() {
        return schoolname;
    }

    public SchoolInfoView setSchoolname(@NotEmpty(message = "學校名稱不得為空") @Size(max = 60, message = "學校名稱長度不能超過60字元") String schoolname) {
        this.schoolname = schoolname;
        return this;
    }

    public @NotEmpty(message = "學校代碼不得為空") @Size(max = 10, message = "學校代碼長度不能超過10字元") String getSchoolid() {
        return schoolid;
    }

    public SchoolInfoView setSchoolid(@NotEmpty(message = "學校代碼不得為空") @Size(max = 10, message = "學校代碼長度不能超過10字元") String schoolid) {
        this.schoolid = schoolid;
        return this;
    }

}
