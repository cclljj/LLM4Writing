package tw.com.slsinfo.essayai.models;


/**
 * Ldap及GWE動作類型<br>
 * 可提供給 ModalWindow使用
 */
public enum ActionType {
    /***
     *
     */
    ACTIVATED("啓用帳號"),
    /***
     *
     */
    LOCKED("鎖定帳號"),
    /***
     *
     */
    UNLOCKED("解鎖帳號"),
    /***
     *
     */
    EXPIRED("停用帳號"),
    /***
     *
     */
    RESETPWD("修改密碼"),
    /***
     *
     */
    RESETACCOUNT("修改帳號"),
    /***
     *
     */
    MODIFIED_ROLE("修改角色"),
    /***
     *
     */
    MODIFIED_CTITLES("修改客製化職稱"),
    /***
     *
     */
    DELETE_STU_DATA("刪除學生資料"),
    /***
     *
     */
    MODIFY_STU_DATA("修改學生資料"),
    /***
     *
     */
    ADD_STU_DATA("新增學生資料"),
    /***
     *
     */
    MODIFY_PID("修改身分證字號"),
    /***
     *
     */
    MODIFY_DEFAULT_ACCOUNT("修改預設帳號"),
    /***
     *
     */
    GWE_SYNC("GWE同步"),
    /***
     *
     */
    CREATE_TEMPUSER("新增臨時帳號"),
    /***
     *
     */
    CREATE_ROLE("新建客製化角色"),
    /***
     *
     */
    DEL_ROLE("刪除客製化角色"),
    /***
     *
     */
    MODIFY_AUTH_ROLE("修改角色授權");

    /***
     *
     * @param value value
     */
    ActionType(String value) {
        this.value = value;
    }

    /***
     *
     */
    private String value;

    /***
     *
     * @return value
     */
    public String getValue() {
        return value;
    }
}
