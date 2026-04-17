package tw.com.slsinfo.essayai.services;

import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.validation.constraints.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.model.IBuiltUserRoles;
import tw.com.slsinfo.essayai.databases.mysql.entities.*;
import tw.com.slsinfo.essayai.models.menu.MenuItemModel;
import tw.com.slsinfo.essayai.models.wicket.UserInfoView;
import tw.com.slsinfo.essayai.models.wicket.admin.AuthPageDropDownItem;
import tw.com.slsinfo.essayai.models.wicket.admin.CRoleModel;
import tw.com.slsinfo.essayai.models.wicket.admin.RoleInfoView;
import tw.com.slsinfo.essayai.models.wicket.admin.RolePermissionView;
import tw.com.slsinfo.essayai.repositories.IRoleUserRepository;
import tw.com.slsinfo.essayai.repositories.ISchoolRepository;
import tw.com.slsinfo.essayai.repositories.IUserAccountRepository;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 系統角色管理
 */
@Stateless
public class RoleUserService {

    private static final Logger logger = LoggerFactory.getLogger(RoleUserService.class);

    @Inject
    private IRoleUserRepository iRoleUserRepository;

    @Inject
    private ISchoolRepository iSchoolRepository;

    @Inject
    private IUserAccountRepository iUserAccountRepository;

    public RoleUserService() {
    }

    /**
     * 單一指令取得角色授權
     */
    private String GetRolePermissions_NativeQuery = "SELECT r.id as rid,r.name as rolename,r.created as created, GROUP_CONCAT(rp.menuname) as menunames from chcsso.rolepermissions rp " +
            "inner join chcsso.role r on r.id=rp.rid   WHERE r.id in :roleids " +
            "group by r.id";

    public Role getStudentRoleName() {
        return iRoleUserRepository.getStudentRoleName();
    }

    public Role getTeacherRoleName() {
        return iRoleUserRepository.getTeacherRoleName();
    }

    /**
     * 取得使用者RoleId
     *
     * @param uid
     * @param schoolid
     * @return
     */
    public List<Integer> getRoleIds(@NotNull String uid, @NotNull String schoolid) {
        return iRoleUserRepository.getRoleUser(uid, schoolid)
                .stream().mapToInt(Roleuser::getId).boxed().collect(Collectors.toList());
    }

    /**
     * 取得客制化使用者RoleId
     *
     * @param uid
     * @param schoolid
     * @param start    roleid開始客制化的編號
     * @return
     */
    public List<Integer> getExtraRoleIds(@NotNull String uid, @NotNull String schoolid, @NotNull int start) {
        return iRoleUserRepository.getRoleUser(uid, schoolid)
                .stream().filter(r -> r.getRid().getId() > start)
                .mapToInt(r -> r.getRid().getId()).boxed().collect(Collectors.toList());
    }

    /**
     * 取得客制化使用者RoleId，彰化縣專案目前是RoleId大於5的（五個內建角色）
     *
     * @param uid
     * @param schoolid
     * @return
     */
    public List<Integer> getExtraRoleIds(@NotNull String uid, @NotNull String schoolid) {
        return getExtraRoleIds(uid, schoolid, 5);
    }

    /**
     * 取得 系統角色 清單
     */
    public List<Roleuser> getRoleUser() {
        return iRoleUserRepository.getRoleUser();
    }

    /**
     * 查詢使用者 系統角色
     *
     * @param uid      帳號
     * @param schoolid 學校代碼
     * @return
     */
    public List<String> getRoleUser(@NotNull String uid, @NotNull String schoolid) {
        return iRoleUserRepository.getRoleUser(uid, schoolid)
                .stream().map(e -> e.getRid().getName()).distinct().toList();
    }

    /**
     * 根據角色及schoolid取得使用者清單
     * @param rid
     * @param schoolid
     * @return
     */
    public List<Roleuser> getRoleUserByRidSid(@NotNull Role rid, @NotNull String schoolid) {
        return iRoleUserRepository.getRoleUserByRidSid(rid, schoolid);
    }

    /**
     * 取得使用者單位代碼
     *
     * @param uid
     * @param schoolid
     * @return
     */
    public List<String> getUserSchool(@NotNull String uid) {
        return iRoleUserRepository.getRoleUser(uid)
                .stream().map(e -> e.getSid().getSid()).distinct().toList();
    }

    /**
     * 取得使用者單位代碼
     *
     * @param uid
     * @param uid
     * @return
     */
    public List<Integer> getUserSid(@NotNull String uid) {
        return iRoleUserRepository.getRoleUser(uid)
                .stream().map(e -> e.getSid().getId()).distinct().toList();
    }

    /**
     * 取得使用者單位代碼
     *
     * @param uid
     * @param uid
     * @return
     */
    public List<Integer> getUid(@NotNull String uid) {
        return iRoleUserRepository.getRoleUser(uid)
                .stream().map(e -> e.getUid().getId()).distinct().toList();
    }

    /**
     * 查詢使用者所有任職單位角色
     *
     * @param uid
     * @return
     */
    public List<String> getRoleUser(@NotNull String uid) {
        return iRoleUserRepository.getRoleUser(uid)
                .stream().map(e -> e.getRid().getName()).distinct().toList();
    }

    /**
     * 查詢使用者 系統角色
     *
     * @param uid      帳號
     * @param schoolid 學校代碼
     * @return
     */
    public List<RoleInfoView> getRoleUserInfo(@NotNull String uid, @NotNull String schoolid) {
        return iRoleUserRepository.getRoleUser(uid, schoolid)
                .stream().map(e -> RoleInfoView.createNew(e.getRid())).toList();
    }

    /**
     * 使用者 職稱 包含 校務系統  客製化
     *
     * @param uid      帳號
     * @param schoolid 學校代碼
     * @return
     */
    public String getAllTitles(@NotNull String uid, @NotNull String schoolid) {
        return iRoleUserRepository.getAllTitles(uid, schoolid);
    }

    /**
     * 取得 role 資料 排除學生 教職員
     *
     * @return
     */
    public List<RoleInfoView> getRole() {
        return iRoleUserRepository.getRole().stream()
                .filter(e -> !e.getName().equals(IBuiltUserRoles.STUDENT))
                .map(RoleInfoView::createNew).toList();
    }

    /**
     * 取得 role 資料 排除學生 系統管理者
     *
     * @return
     */
    public List<RoleInfoView> getRoleExcludeDefault() {
        return iRoleUserRepository.getRole().stream()
                .filter(e -> !e.getName().equals(IBuiltUserRoles.STUDENT))
                .filter(e -> !e.getName().equals(IBuiltUserRoles.SUPERVISOR))
                .map(RoleInfoView::createNew).toList();
    }


    /**
     * @param selected
     * @param userInfoView
     * @return
     */
    public boolean updateRoleUser(List<RoleInfoView> selected, UserInfoView userInfoView) {

        School school = iSchoolRepository.referenceById(userInfoView.getSchool_id());
        User user = iUserAccountRepository.referenceById(userInfoView.getUser_id());

        try {
            //目前的資料
            List<Roleuser> roleusers = iRoleUserRepository.getRoleUser(userInfoView.getUid(), userInfoView.getSchoolid());

            //舊資料
            List<RoleInfoView> oldData = roleusers.stream().map(e -> RoleInfoView.createNew(e.getRid())).toList();

            // Step 2: 建立目前的角色 ID 清單
            Set<Integer> oldRoleIds = roleusers.stream()
                    .map(r -> r.getRid().getId())
                    .collect(Collectors.toSet());

            // Step 3: 建立新選取的角色 ID 清單
            Set<Integer> newRoleIds = selected.stream()
                    .map(RoleInfoView::get_id)
                    .collect(Collectors.toSet());

            // Step 4: 固定把教職員角色寫入 rid = 4
            newRoleIds.add(4);

            // Step 4: 計算要新增的角色
            Set<Integer> rolesToAdd = new HashSet<>(newRoleIds);
            rolesToAdd.removeAll(oldRoleIds);

            rolesToAdd.forEach(rid -> {
                iRoleUserRepository.updateUserRole(rid, user, school);
            });

            // Step 5: 計算要移除的角色
            Set<Integer> rolesToRemove = new HashSet<>(oldRoleIds);
            rolesToRemove.removeAll(newRoleIds);
            rolesToRemove.forEach(e -> {
                roleusers.stream().filter(r ->
                        e.equals(r.getRid().getId())).forEach(
                        r -> iRoleUserRepository.deleteUserRole(r));
            });

            //新資料
            /*List<RoleInfoView> addItem = new ArrayList<>(selected);
            addItem.removeAll(oldData);
            logger.debug("addItem {}", addItem.toString());
            addItem.forEach(e -> {
                iRoleUserRepository.updateUserRole(e.get_id(), user, school);
            });*/

            /*List<RoleInfoView> removeItem = new ArrayList<>(oldData);
            removeItem.removeAll(selected);
            logger.debug("removeItem {}", removeItem.toString());

            removeItem.forEach(e -> {
                roleusers.stream().filter(r ->
                        e.get_id() == r.getRid().getId()).forEach(
                        r -> iRoleUserRepository.deleteUserRole(r));
            });*/
            return true;
        } catch (Exception e) {
            return false;
        }

    }

    /**
     * @param roletype
     * @return
     */
    public List<RolePermissionView> getRolePermissions(@NotNull String roletype) {
        return iRoleUserRepository.getRolePermissionsView(roletype);
    }

    public boolean existsRole(CRoleModel cRoleModel) {
        Optional<Role> optionalRole =
                iRoleUserRepository.getRole().stream().filter(e -> e.getName().equals(cRoleModel.getRolename())).findFirst();
        return optionalRole.isPresent();

    }

    public void createRole(CRoleModel cRoleModel) {
        Role role = new Role();
        role.setName(cRoleModel.getRolename());
        iRoleUserRepository.createRole(role);

    }

    public void deleteRole(Integer roleId) {
        iRoleUserRepository.deleteRole(roleId);
    }

    public List<AuthPageDropDownItem> getAllAuthRoleModel() {
        return iRoleUserRepository.getAllAuthPageItems();
    }

    public List<AuthPageDropDownItem> getAllAuthPageItemsByMenuNames(@NotNull List<String> menuNames) {
        return iRoleUserRepository.getAllAuthPageItemsByMenuNames(menuNames);
    }

    public List<AuthPageDropDownItem> getAllAuthPageItemsByRoleId(@NotNull Integer roleId) {
        return iRoleUserRepository.getAllAuthPageItemsByRoleId(roleId);
    }

    public List<Authpage> getAllAuthPageByMenuNames(@NotNull List<String> menuNames) {
        return iRoleUserRepository.getAllAuthPageByMenuNames(menuNames);
    }

    public List<Authpage> getAllAuthPageById(@NotNull List<Integer> apids) {
        return iRoleUserRepository.getAllAuthPageById(apids);
    }

    public void updateRolePermissions(@NotNull Role role) {
        iRoleUserRepository.updateRolePermissions(role);
    }

    public List<MenuItemModel> getRoleMenus(List<Role> roleId) {
        return iRoleUserRepository.getMenuItemModel(roleId);
    }

    public List<String> rolesAuthorizedToInstantiate(String simpleName) {
        return iRoleUserRepository.rolesAuthorizedToInstantiate(simpleName);
    }
}