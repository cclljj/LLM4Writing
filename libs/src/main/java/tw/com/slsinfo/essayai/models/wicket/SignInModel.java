package tw.com.slsinfo.essayai.models.wicket;

import tw.com.slsinfo.commons.io.SerializeModel;

import java.io.Serial;


/**
 * 使用者登入Payload
 */
public class SignInModel extends SerializeModel {
    @Serial
    private static final long serialVersionUID = 1L;
    private String username;
    private String password;
    private String captcha;
    private String anticsrf;
    //預設每次SUBMIT均會重新產生，用來和anticsrf比對
    private String uuid;

    public SignInModel(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public SignInModel(String username, String password, String captcha) {
        this.username = username;
        this.password = password;
        this.captcha = captcha;
    }

    public String getUuid() {
        return uuid;
    }

    public SignInModel setUuid(String uuid) {
        this.uuid = uuid;
        return this;
    }

    public String getAnticsrf() {
        return anticsrf;
    }

    public SignInModel setAnticsrf(String anticsrf) {
        this.anticsrf = anticsrf;
        return this;
    }

    public SignInModel() {
    }

    public String getPassword() {
        return password;
    }

    public SignInModel setPassword(String password) {
        this.password = password;
        return this;
    }

    public String getCaptcha() {
        return captcha;
    }

    public SignInModel setCaptcha(String captcha) {
        this.captcha = captcha;
        return this;
    }

    public String getUsername() {
        return username;
    }

    public SignInModel setUsername(String username) {
        this.username = username;
        return this;
    }
}
