package tw.com.slsinfo.essayai.models.wicket.admin;

import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.Authpage;

import java.util.Objects;


/**
 * 頁面授權下拉選單Payload
 */
public class AuthPageDropDownItem extends SerializeModel {
    private Integer authpageid;
    private String menuname;


    public AuthPageDropDownItem() {
    }

    public AuthPageDropDownItem(Authpage authpage) {
        this.menuname = authpage.getMenuname();
        this.authpageid = authpage.getId();
    }

    public Integer getAuthpageid() {
        return authpageid;
    }

    public AuthPageDropDownItem setAuthpageid(Integer authpageid) {
        this.authpageid = authpageid;
        return this;
    }

    public String getMenuname() {
        return menuname;
    }

    public AuthPageDropDownItem setMenuname(String menuname) {
        this.menuname = menuname;
        return this;
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (!(obj instanceof AuthPageDropDownItem model)) return false;
        return Objects.equals(getMenuname(), model.getMenuname()) && Objects.equals(getAuthpageid(), model.getAuthpageid());

    }
}
