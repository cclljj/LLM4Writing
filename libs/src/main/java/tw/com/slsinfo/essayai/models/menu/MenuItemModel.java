package tw.com.slsinfo.essayai.models.menu;


import tw.com.slsinfo.commons.io.SerializeModel;

import java.util.Objects;

public class MenuItemModel extends SerializeModel {
    /**
     * 選單超連結
     */
    private String menulink;
    /**
     * 選單說明文字
     */
    private String menutext;

    public MenuItemModel(String menulink, String menutext) {
        this.menulink = menulink;
        this.menutext = menutext;
    }

    public MenuItemModel() {
    }

    public String getMenulink() {
        return menulink;
    }

    public MenuItemModel setMenulink(String menulink) {
        this.menulink = menulink;
        return this;
    }

    public String getMenutext() {
        return menutext;
    }

    public MenuItemModel setMenutext(String menutext) {
        this.menutext = menutext;
        return this;
    }


    @Override
    public boolean equals(Object o) {
        if (!(o instanceof MenuItemModel that)) return false;
        return Objects.equals(getMenulink(), that.getMenulink()) && Objects.equals(getMenutext(), that.getMenutext());
    }

    @Override
    public int hashCode() {
        return Objects.hash(getMenulink(), getMenutext());
    }
}
