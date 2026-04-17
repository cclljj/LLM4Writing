package tw.com.slsinfo.essayai.models;

import tw.com.slsinfo.commons.io.SerializeModel;

/**
 * 回傳登入結果
 */
public class AuthResult extends SerializeModel {

    /**
     * 登入驗證次否成功
     */
    private boolean success;

    /**
     * LDAP 訊息
     */
    private Status message;


    /**
     * @param success 登入成功與否
     * @param message 結果訊息
     */
    public AuthResult(boolean success, Status message) {
        this.message = message;
        this.success = success;
    }

    public AuthResult() {
    }

    public Status getMessage() {
        return message;
    }

    public AuthResult setMessage(Status message) {
        this.message = message;
        return this;
    }

    public boolean isSuccess() {
        return success;
    }

    public AuthResult setSuccess(boolean success) {
        this.success = success;
        return this;
    }

    public enum Status {
        SUCCESS("登入成功"),
        INVALID_CREDENTIALS("帳號或密碼錯誤"),
        ACCOUNT_LOCKED("帳號鎖定五分"),
        PASSWORD_EXPIRED("密碼逾期"),
        UNEXPECTED("不可預期的錯誤");

        private String message;

        Status(String message) {
            this.message = message;
        }

        public String getMessage() {
            return message;
        }
    }

}


