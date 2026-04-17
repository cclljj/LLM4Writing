package tw.com.slsinfo.essayai.models.system;

import tw.com.slsinfo.commons.io.SerializeModel;

/**
 * 變更密碼
 */
public class ResetPwdModel extends SerializeModel {

    private String uid;
    private String oldPassword;
    private String newPassword;
    private String newPassword2;

    public ResetPwdModel() {
    }

    public String getUid() {
        return uid;
    }

    public ResetPwdModel setUid(String uid) {
        this.uid = uid;
        return this;
    }

    public String getNewPassword() {
        return newPassword;
    }

    public ResetPwdModel setNewPassword(String newPassword) {
        this.newPassword = newPassword;
        return this;
    }

    public String getOldPassword() {
        return oldPassword;
    }

    public void setOldPassword(String oldPassword) {
        this.oldPassword = oldPassword;
    }

    public String getNewPassword2() {
        return newPassword2;
    }

    public void setNewPassword2(String newPassword2) {
        this.newPassword2 = newPassword2;
    }
}
