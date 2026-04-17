package tw.com.slsinfo.essayai.models.wicket;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import tw.com.slsinfo.commons.io.SerializeModel;

/**
 * 個人聯絡資料修改
 */
public class ModifyUserDataModel extends SerializeModel {


    /**
     * user primary key
     */
    private int user_id;

    @NotEmpty(message = "請填寫電子郵件")
    @Email(message = "請填寫合法電子郵件格式")
    @Size(max = 60, message = "電子郵件不得超過60字元")
    private String email;


    private String captcha;


    public ModifyUserDataModel() {
    }

    public ModifyUserDataModel(int user_id) {
        this.user_id = user_id;
    }

    public ModifyUserDataModel(int user_id, String email, String captcha) {
        this.user_id = user_id;
        this.email = email;
        this.captcha = captcha;
    }

    public ModifyUserDataModel(String email, String captcha) {
        this.email = email;
        this.captcha = captcha;
    }

    public ModifyUserDataModel(UserInfoView userInfoView) {
        this.user_id = userInfoView.getUser_id();
        this.email = userInfoView.getEmail();
    }

    public int getUser_id() {
        return user_id;
    }

    public ModifyUserDataModel setUser_id(int user_id) {
        this.user_id = user_id;
        return this;
    }

    public @NotEmpty(message = "請填寫電子郵件") @Email(message = "請填寫合法電子郵件格式") @Size(max = 60, message = "電子郵件不得超過60字元") String getEmail() {
        return email;
    }

    public ModifyUserDataModel setEmail(@NotEmpty(message = "請填寫電子郵件") @Email(message = "請填寫合法電子郵件格式") @Size(max = 60, message = "電子郵件不得超過60字元") String email) {
        this.email = email;
        return this;
    }

//    public @Size(max = 45, message = "行動電話不得超過45字元") @Pattern(regexp = "^09\\d{2}(\\d{6}|-\\d{3}-\\d{3})", message = "請填寫合法行動電話格式") String getMobile() {
//        return mobile;
//    }
//
//    public ModifyUserDataModel setMobile(@Size(max = 45, message = "行動電話不得超過45字元") @Pattern(regexp = "^09\\d{2}(\\d{6}|-\\d{3}-\\d{3})", message = "請填寫合法行動電話格式") String mobile) {
//        this.mobile = mobile;
//        return this;
//    }


    public String getCaptcha() {
        return captcha;
    }

    public ModifyUserDataModel setCaptcha(String captcha) {
        this.captcha = captcha;
        return this;
    }
}
