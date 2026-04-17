package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.validation.constraints.NotNull;
import tw.com.slsinfo.essayai.databases.mysql.entities.*;
import tw.com.slsinfo.essayai.models.menu.MenuItemModel;
import tw.com.slsinfo.essayai.models.wicket.admin.AuthPageDropDownItem;
import tw.com.slsinfo.essayai.databases.mysql.entities.Authpage;
import tw.com.slsinfo.essayai.models.wicket.admin.RolePermissionView;

import java.util.List;

@Local
public interface IRoleUserRepository {


    /**
     * 取得學生 Role 物件
     *
     * @return
     */
    Role getStudentRoleName();


    /**
     * 取得學教職員 Role 物件
     *
     * @return
     */
    Role getTeacherRoleName();


    /**
     * 取得學教職員 Role 物件
     *
     * @return
     */
    Role createRole(@NotNull Role role);

    /**
     * 查詢 Role 物件
     *
     * @param roleName 角色名稱
     * @return
     */
    List<Role> getRoleByRoleName(@NotNull String roleName);

    /**
     * 查詢系統角色
     *
     * @return
     */
    List<Role> getRole();

    /**
     * 取得 系統角色 清單
     */
    List<Roleuser> getRoleUser();

    /**
     * 查詢使用者系統角色
     *
     * @param uid      帳號
     * @param schoolid 學校代碼
     * @return
     */
    List<Roleuser> getRoleUser(@NotNull String uid, @NotNull String schoolid);


    /**
     * 根據角色及schoolid取得使用者清單
     * @param rid
     * @param schoolid
     * @return
     */
    List<Roleuser> getRoleUserByRidSid(@NotNull Role rid, @NotNull String schoolid);

    /**
     * 取得系統內的職稱 校務系統 &amp;&amp; 客製化 組合 ,分開
     *
     * @param uid
     * @param schoolid
     * @return
     */
    String getAllTitles(@NotNull String uid, @NotNull String schoolid);

    /**
     * 更新使用者 系統角色
     *
     * @param rid
     * @param user
     * @param school
     */
    void updateUserRole(@NotNull int rid, @NotNull User user, @NotNull School school);

    /**
     * 刪除使用者 系統角色
     *
     * @param roleuser
     */
    void deleteUserRole(@NotNull Roleuser roleuser);


    /**
     * 依傳入的角色類型，回傳顯示在頁面中的Payload
     *
     * @param roletype
     * @return
     */
    List<RolePermissionView> getRolePermissionsView(@NotNull String roletype);

    /**
     * 取得所有可授權功能頁面下拉清單來源
     *
     * @return
     */
    List<AuthPageDropDownItem> getAllAuthPageItems();

    /**
     * 依傳入menuname取得下拉清單，用在已授權時，會放在CRoleAuthModel之中，呈現已選擇
     *
     * @param menuNames
     * @return
     */
    List<AuthPageDropDownItem> getAllAuthPageItemsByMenuNames(@NotNull List<String> menuNames);


    /**
     * 依傳入的menuname取得授權頁面資訊，以備後續寫入RolePermission表
     *
     * @param menuNames
     * @return
     */
    List<Authpage> getAllAuthPageByMenuNames(@NotNull List<String> menuNames);

    /**
     * 依傳入的aothpage id取得授權頁面資訊，以備後續寫入RolePermission表
     *
     * @param apids
     * @return
     */
    List<Authpage> getAllAuthPageById(@NotNull List<Integer> apids);

    /**
     * 依傳入的角色ID，回傳顯示在頁面中授權功能名稱，用在後續顯示已授權功能之用
     *
     * @param roleid
     * @return
     */
    List<String> getRolePermissionsByRoleId(@NotNull Integer roleid);

    /**
     * 傳入RoleId，取得已授權清單
     *
     * @param roleid
     * @return
     */
    List<AuthPageDropDownItem> getAllAuthPageItemsByRoleId(@NotNull Integer roleid);

    /**
     * 移除角色，會一併移除配給角色的權限表
     *
     * @param roleid
     */
    void deleteRole(Integer roleid);

    /**
     * 假設使用者只在單一單位
     *
     * @param uid
     * @return
     */
    List<Roleuser> getRoleUser(@NotNull String uid);

    /**
     * 更新角色權限功能
     *
     * @param role
     */
    void updateRolePermissions(@NotNull Role role);

    List<MenuItemModel> getMenuItemModel(@NotNull List<Role> roles);

    List<String> rolesAuthorizedToInstantiate(String getSimpleName);
}