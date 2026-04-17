package tw.com.slsinfo.essayai.models.wicket.admin;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import tw.com.slsinfo.commons.io.SerializeModel;


/**
 * 角色建立與查詢Payload
 */
public class CRoleModel extends SerializeModel {
    private static final long serialVersionUID = 1L;
    /**
     * 角色名
     */
    @NotEmpty(message = "角色名稱不得空白")
    @Size(min = 2, max = 32, message = "角色名稱長度為2-32個字元")
    private String rolename;
    private Integer roleid;
    /**
     * 角色類型
     */
    private String roletype;

    public @NotEmpty(message = "角色名稱不得空白") @Size(min = 2, max = 32, message = "角色名稱長度為2-32個字元") String getRolename() {
        return rolename;
    }

    public CRoleModel setRolename(@NotEmpty(message = "角色名稱不得空白") @Size(min = 2, max = 32, message = "角色名稱長度為2-32個字元") String rolename) {
        this.rolename = rolename;
        return this;
    }

    public Integer getRoleid() {
        return roleid;
    }

    public CRoleModel setRoleid(Integer roleid) {
        this.roleid = roleid;
        return this;
    }

    public String getRoletype() {
        return roletype;
    }

    public CRoleModel setRoletype(String roletype) {
        this.roletype = roletype;
        return this;
    }
}
