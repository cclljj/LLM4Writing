package tw.com.slsinfo.essayai.models.wicket.admin;

import tw.com.slsinfo.essayai.databases.mysql.entities.Role;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.util.Objects;

/**
 * 角色
 */
public class RoleInfoView extends SerializeModel {

    private int _id;

    private String name;

    public RoleInfoView() {
    }

    public RoleInfoView(int _id, String name) {
        this._id = _id;
        this.name = name;
    }

    public static RoleInfoView createNew(Role role){
        return new RoleInfoView(role.getId(), role.getName());
    }

    public int get_id() {
        return _id;
    }

    public void set_id(int _id) {
        this._id = _id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RoleInfoView model)) return false;
        return Objects.equals(get_id(), model.get_id());
    }
}
