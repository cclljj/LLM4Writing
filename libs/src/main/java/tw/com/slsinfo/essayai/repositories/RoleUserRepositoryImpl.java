package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.constraints.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.commons.io.DTUtils;
import tw.com.slsinfo.commons.model.IBuiltUserRoles;
import tw.com.slsinfo.essayai.databases.mysql.NamedProcedureNames;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.*;
import tw.com.slsinfo.essayai.models.menu.MenuItemModel;
import tw.com.slsinfo.essayai.models.wicket.admin.AuthPageDropDownItem;
import tw.com.slsinfo.essayai.databases.mysql.entities.Authpage;
import tw.com.slsinfo.essayai.models.wicket.admin.RolePermissionView;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static java.util.stream.Collectors.groupingBy;

@Stateless
@Local(IRoleUserRepository.class)
public class RoleUserRepositoryImpl implements IRoleUserRepository {

    private static final Logger logger = LoggerFactory.getLogger(RoleUserRepositoryImpl.class);


    private final IRDBCrudService<Role> roleIRDBCrudService;


    private final IRDBCrudService<Roleuser> roleuserIRDBCrudService;


    private final IRDBCrudService<Rolepermission> rolepermissionIRDBCrudService;

    private final IRDBCrudService<Authpage> authpageIRDBCrudService;

    @Inject
    public RoleUserRepositoryImpl(IRDBCrudService<Authpage> authpageIRDBCrudService,
                                  IRDBCrudService<Role> roleIRDBCrudService,
                                  IRDBCrudService<Roleuser> roleuserIRDBCrudService,
                                  IRDBCrudService<Rolepermission> rolepermissionIRDBCrudService) {
        this.authpageIRDBCrudService = authpageIRDBCrudService;
        this.roleIRDBCrudService = roleIRDBCrudService;
        this.roleuserIRDBCrudService = roleuserIRDBCrudService;
        this.rolepermissionIRDBCrudService = rolepermissionIRDBCrudService;
    }

    @Override
    public Role getStudentRoleName() {
        return getRoleByRoleName("學生").get(0);
    }

    @Override
    public Role getTeacherRoleName() {
        return getRoleByRoleName("教師").get(0);
    }

    //todo: commons沒有實作dynamicQuery
//    @Override
//    public List<Role> getRoleByRoleName(@NotNull String roleName) {
//        List<Operator> operators = new ArrayList<>();
//        operators.add(new Operator(Operator.Condition.EQ, "name", roleName));
//        return roleIRDBCrudService.dynamicQuery(Role.class, operators);
//    }

    @Override
    public List<Role> getRoleByRoleName(@NotNull String roleName) {
        return roleIRDBCrudService.findWithNamedQuery(NamedQueryNames.FIND_ROLE_BY_ROLENAME, QueryParameterBuilder.start("rolename", roleName));
    }

    @Override
    public List<Role> getRole() {
        return roleIRDBCrudService.findAll(Role.class);
    }

    /**
     * 取得 系統角色 清單
     */
    @Override
    public List<Roleuser> getRoleUser() {
        return roleuserIRDBCrudService.findAll(Roleuser.class);
    }

    /**
     * @param uid
     * @param schoolid
     * @return
     */
    @Override
    public List<Roleuser> getRoleUser(@NotNull String uid, @NotNull String schoolid) {
        return roleuserIRDBCrudService.findCacheableWithNamedQuery(NamedQueryNames.GETROLEUSER
                , QueryParameterBuilder.start("uid", uid).with("schoolid", schoolid).build());
    }

    /**
     * 根據角色及schoolid取得使用者清單
     * @param rid
     * @param schoolid
     * @return
     */
    @Override
    public List<Roleuser> getRoleUserByRidSid(@NotNull Role rid, @NotNull String schoolid) {
        return roleuserIRDBCrudService.findCacheableWithNamedQuery(NamedQueryNames.FIND_ROLEUSER_BY_SID_RID
                , QueryParameterBuilder.start("rid", rid).with("schoolid", schoolid).build());
    }


    /**
     * 取得 TitleMapping 校務系統職稱 &amp;&amp; Ctitlesmapping 自定義職稱 組合
     * <p>
     * PROCEDURE GetTitles
     * in sid, in uid
     * out varchar(256)
     *
     * @param uid      帳號
     * @param schoolid 學校代碼
     * @return
     */
    @Override
    public String getAllTitles(String uid, String schoolid) {
        Map<String, Object> map = new WeakHashMap<>();
        map.put("uid", uid);
        map.put("schoolid", schoolid);
        return (String) roleuserIRDBCrudService.procedureQuery(NamedProcedureNames.PROCEDURE_GET_TITLES, map, "alltitles");
    }

    /**
     * 更新UserRole
     *
     * @param rid
     * @param user
     * @param school
     */
    @Override
    @Transactional
    public void updateUserRole(@NotNull int rid, @NotNull User user, @NotNull School school) {
        Role role = roleIRDBCrudService.reference(Role.class, rid);
        roleuserIRDBCrudService.update(new Roleuser().setRid(role).setUid(user).setSid(school));

    }

    @Override
    @Transactional
    public void deleteUserRole(Roleuser roleuser) {
        roleuserIRDBCrudService.delete(Roleuser.class, roleuser.getId());
    }

    @Override
    public List<RolePermissionView> getRolePermissionsView(String roletype) {
        List<RolePermissionView> rolePermissionViews = new ArrayList<>();
        List<Role> roles = new ArrayList<>();
        switch (roletype) {
            case IBuiltUserRoles.BUILTIN_ROLE:
                roles = roleIRDBCrudService.findWithNamedQuery(
                        NamedQueryNames.FIND_DISTINCT_ROLEPERMISSION_BY_BUILTIN,
                        QueryParameterBuilder.start("builtin", Boolean.TRUE).build()
                );
                break;
            case IBuiltUserRoles.CUSTOM_ROLE:
                //找到所有非內建角色，本系統內建到5
                roles = roleIRDBCrudService.findWithNamedQuery(
                        NamedQueryNames.FIND_EXTRA_ROLE_GREAT_THAN_ROLEID,
                        QueryParameterBuilder.start("roleid", 5).build()
                );
                break;
        }

        roles.forEach(role -> {
//            logger.debug("RoleType {} count : {}", roletype, role.getId());
        });


        //取得授權內容，如果是客制化角色也會取得授權內容
        rolepermissionIRDBCrudService.findWithNamedQuery(
                        NamedQueryNames.FIND_ROLEPERMISSION_BY_ROLEIDS,
                        QueryParameterBuilder.start("roleids", roles).build())
                .stream().collect(groupingBy(Rolepermission::getRid))
                .forEach((role, permissions) -> {
                    if (!permissions.isEmpty()) {
                        RolePermissionView rolePermissionView = new RolePermissionView();
                        rolePermissionView.setRoleid(role.getId());
                        rolePermissionView.setRolename(role.getName());
                        rolePermissionView.setRoletype(roletype);
                        rolePermissionView.setCreated(DTUtils.parseISODateTime(role.getCreated().toString()));
                        rolePermissionView.setAuthpages(
                                permissions.stream().map(Rolepermission::getMenuname).toList()
                        );
                        rolePermissionViews.add(rolePermissionView);
                    }
                });

        //客制化角色排除已授權角色外，其餘沒有授權角色也要顯示
        if (roletype.equals(IBuiltUserRoles.CUSTOM_ROLE)) {
            roles.forEach(role -> {
                boolean isNotContain = rolePermissionViews.stream().filter(rp -> rp.getRolename().equals(role.getName())).findAny().isEmpty();
                if (isNotContain) {
                    RolePermissionView rolePermissionView = new RolePermissionView();
                    rolePermissionView.setRoleid(role.getId());
                    rolePermissionView.setRolename(role.getName());
                    rolePermissionView.setRoletype(roletype);
                    rolePermissionView.setCreated(DTUtils.parseISODateTime(role.getCreated().toString()));
                    rolePermissionView.setAuthpages(new ArrayList<>());
                    rolePermissionViews.add(rolePermissionView);
                }
            });
        }

        return rolePermissionViews;
    }


    /**
     * {@inheritDoc}
     *
     * @return
     */
    @Override
    public List<AuthPageDropDownItem> getAllAuthPageItems() {
        List<AuthPageDropDownItem> authPageDropDownItems = new ArrayList<>();
        authpageIRDBCrudService.findAll(Authpage.class).forEach(authPage -> {
            AuthPageDropDownItem authPageDropDownItem = new AuthPageDropDownItem(authPage);
            authPageDropDownItems.add(authPageDropDownItem);
        });
        return authPageDropDownItems;
    }

    /**
     * {@inheritDoc}
     *
     * @param menuNames
     * @return
     */
    @Override
    public List<AuthPageDropDownItem> getAllAuthPageItemsByMenuNames(@NotNull List<String> menuNames) {
        List<AuthPageDropDownItem> authPageDropDownItems = new ArrayList<>();
        authpageIRDBCrudService.findCacheableWithNamedQuery(NamedQueryNames.GET_AUTHPAGE_BY_MENUNAME,
                QueryParameterBuilder.start("menunames", menuNames).build()).forEach(authPage -> {
            AuthPageDropDownItem authPageDropDownItem = new AuthPageDropDownItem(authPage);
            authPageDropDownItems.add(authPageDropDownItem);
        });
        return authPageDropDownItems;
    }


    /**
     * {@inheritDoc}
     *
     * @param menuNames
     * @return
     */
    @Override
    public List<Authpage> getAllAuthPageByMenuNames(@NotNull List<String> menuNames) {
        return authpageIRDBCrudService.findCacheableWithNamedQuery(NamedQueryNames.GET_AUTHPAGE_BY_MENUNAME,
                QueryParameterBuilder.start("menunames", menuNames).build()).stream().toList();
    }

    /**
     * {@inheritDoc}
     *
     * @param apids
     * @return
     */
    @Override
    public List<Authpage> getAllAuthPageById(@NotNull List<Integer> apids) {
        return authpageIRDBCrudService.findCacheableWithNamedQuery(NamedQueryNames.GET_AUTHPAGE_BY_APIDS,
                QueryParameterBuilder.start("apids", apids).build()).stream().toList();
    }

    /**
     * {@inheritDoc}
     *
     * @param roleid
     * @return
     */
    @Override
    public List<String> getRolePermissionsByRoleId(Integer roleid) {
        List<String> menuNames = new ArrayList<>();
        rolepermissionIRDBCrudService.findWithNamedQuery(
                        NamedQueryNames.FIND_ROLEPERMISSION_BY_ROLEIDS,
                        QueryParameterBuilder.start("roleids", new Role(roleid)).build())
                .forEach(permissions -> {
                    menuNames.add(permissions.getMenuname());
                });

        return menuNames;
    }

    /**
     * {@inheritDoc}
     *
     * @param roleid
     * @return
     */
    @Override
    public List<AuthPageDropDownItem> getAllAuthPageItemsByRoleId(Integer roleid) {
        return getAllAuthPageItemsByMenuNames(
                getRolePermissionsByRoleId(roleid)
        );
    }

    /**
     * {@inheritDoc}
     *
     * @param roleid
     */
    @Override
    public void deleteRole(Integer roleid) {
        roleIRDBCrudService.delete(Role.class, roleid);
    }

    @Override
    public List<Roleuser> getRoleUser(String uid) {
        return roleuserIRDBCrudService.findCacheableWithNamedQuery(NamedQueryNames.GETANYROLEUSER
                , QueryParameterBuilder.start("uid", uid).build());
    }

    @Override
    public Role createRole(Role role) {
        return roleIRDBCrudService.create(role);
    }

    @Override
    public void updateRolePermissions(@NotNull Role role) {


        // 新資料 (來自前端)
        Set<String> newComponents = role.getRolepermissions().stream()
                .map(Rolepermission::getComponent)
                .collect(Collectors.toSet());

        // 舊資料 (來自資料庫)
        Map<String, Rolepermission> oldDataMap = rolepermissionIRDBCrudService
                .findWithNamedQuery(NamedQueryNames.FIND_ROLEPERMISSION_BY_ROLEID,
                        QueryParameterBuilder.start("roleid", role).build())
                .stream().collect(Collectors.toMap(Rolepermission::getComponent, Function.identity()));

        //  新增的：新資料有但舊資料沒有的
        role.getRolepermissions().stream()
                .filter(rp -> !oldDataMap.containsKey(rp.getComponent()))
                .forEach(rolepermissionIRDBCrudService::create);

        // 刪除的：舊資料有但新資料沒有的
        oldDataMap.forEach((component, rp) -> {
            if (!newComponents.contains(component)) {
                rolepermissionIRDBCrudService.delete(Rolepermission.class, rp.getId());
            }
        });

        /*//移除 Role Permission
        rolepermissionIRDBCrudService.findWithNamedQuery(NamedQueryNames.CHCSSO_FIND_ROLEPERMISSION_BY_ROLEID,
                QueryParameterBuilder.start("roleid", role).build()).forEach(rolepermission -> {
            rolepermissionIRDBCrudService.delete(Rolepermission.class, rolepermission.getId());
        });

        role.getRolepermissions().forEach(rolepermission -> {
            rolepermissionIRDBCrudService.create(rolepermission);
        });*/
        /*Integer deleted = rolepermissionIRDBCrudService.deleteRecordWithNameQuery(
                NamedQueryNames.CHCSSO_DELETE_ROLEPERMISSION_BY_ROLE_ID,
                QueryParameterBuilder.start("roleid", role.getId()).build()
        );
        logger.debug("Deleted role {}  with permissions: {}", role.getId(), deleted);
        roleIRDBCrudService.update(role);*/
    }

    @Override
    public List<MenuItemModel> getMenuItemModel(List<Role> roles) {
        List<MenuItemModel> menuItems = new ArrayList<>();
        rolepermissionIRDBCrudService.findCacheableWithNamedQuery(NamedQueryNames.FIND_EXTRA_ROLEPERMISSION_BY_ROLEID
                        , QueryParameterBuilder.start("builtin", false)
                                .with("roleids", roles).build())
                .forEach(rp -> {
                    MenuItemModel menuItem = new MenuItemModel();
                    menuItem.setMenulink(rp.getPkg().concat(".").concat(rp.getComponent()));
                    menuItem.setMenutext(rp.getMenuname());
                    menuItems.add(menuItem);
                });
        return menuItems;
    }

    @Override
    public List<String> rolesAuthorizedToInstantiate(String getSimpleName) {
        List<String> roleslist = new ArrayList<>();
        rolepermissionIRDBCrudService.findWithNamedQuery(
                        NamedQueryNames.FIND_ROLE_BY_COMPONENTCLASSNAME,
                        QueryParameterBuilder.start("component", getSimpleName).build())
                .forEach(rp -> {
                    logger.debug("Permission : {}", rp.getRid().getName());
                    roleslist.add(rp.getRid().getName());
                });
        return roleslist;
    }
}
