package tw.com.slsinfo.essayai.models.wicket.admin;

import java.util.List;

/**
 * 使用者角角管理表格內容Payload
 */
public class RolePermissionView extends CRoleModel {
    /**
     * 授權功能項目
     */
    private List<String> authpages;
    /**
     * 角色建立時間
     */
    private String created;

    public RolePermissionView() {
    }

    public List<String> getAuthpages() {
        return authpages;
    }

    public RolePermissionView setAuthpages(List<String> authpages) {
        this.authpages = authpages;
        return this;
    }

    public String getCreated() {
        return created;
    }

    public RolePermissionView setCreated(String created) {
        this.created = created;
        return this;
    }

}
