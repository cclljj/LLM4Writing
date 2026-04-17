package tw.com.slsinfo;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.logging.log4j.util.Strings;
import org.apache.wicket.authroles.authentication.AuthenticatedWebSession;
import org.apache.wicket.authroles.authorization.strategies.role.Roles;
import org.apache.wicket.request.Request;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.essayai.services.RoleUserService;
import tw.com.slsinfo.essayai.services.UserAccountService;

import java.io.Serial;
import java.io.Serializable;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

public class WicketSession extends AuthenticatedWebSession {

    @Serial
    private static final long serialVersionUID = 1L;
    private static Logger logger = LoggerFactory.getLogger(WicketSession.class);
    //使用者學校代碼
    private final String SCHOOLID = "schoolid";
    private final String SID = "sid";

    private final String SCHOOLNAME = "schoolname";
    //使用者帳號
    private final String USERNAME = "username";
    private final String UID = "uid";
    //使用者姓名
    private final String TRUENAME = "truename";
    private final String ROLE = "role";
    private final String TITLES = "titles";
    /**
     * Group ID：用在chat時，同一小組人員均可收到訊息之用
     */
    private final String GROUPID = "groupid";

    /**
     * Construct.
     *
     * @param request The current request object
     */
    public WicketSession(Request request) {
        super(request);
    }

    @Override
    protected boolean authenticate(String username, String password) {
        UserAccountService userAccountService = CDI.current().select(UserAccountService.class).get();
        RoleUserService roleUserService = CDI.current().select(RoleUserService.class).get();
        List<User> users = userAccountService.doUserLogin(username, password);
        boolean authenticated = !users.isEmpty();
        if (authenticated) {
            setUsername(username);
            List<String> roles = roleUserService.getRoleUser(username);
            List<String> schools = roleUserService.getUserSchool(username);
            List<Integer> sids = roleUserService.getUserSid(username);
            setSchoolid(schools.get(0));
            setSid(sids.get(0));
            setUid(users.get(0));
            logger.debug("User {} has roles {}", username, roles);
            setRoleUser(roles);
            String title = userAccountService.getUserTitleString(username).get(0);
            setTitles(title);
            setTrueName(users.get(0).getName());
        }
        return authenticated;
    }


    @Override
    public Roles getRoles() {
        Roles roles = new Roles();
        if (isSignedIn()) {
            roles.add(Roles.USER);
            roles.addAll(getRoleUsers());
        }
        return roles;
    }

    /**
     * 將學校代碼儲存在SESSION
     *
     * @param sid
     */
    public void setSid(Integer sid) {
        setAttribute(SID, sid);
    }

    /**
     * 從SESSION中取得學校代碼
     *
     * @return
     */
    public Integer getSid() {
        return Optional.ofNullable((Integer) getAttribute(SID)).orElse(0);
    }

    /**
     * 將學校代碼儲存在SESSION
     *
     * @param schoolid
     */
    public void setSchoolid(String schoolid) {
        setAttribute(SCHOOLID, schoolid);
    }


    /**
     * 小組代碼
     *
     * @return
     */
    public int getGroupid() {
        return Optional.ofNullable((Integer) getAttribute(GROUPID))
                .orElse(0);
    }

    /**
     * 小組代碼
     *
     * @param groupid
     */
    public void setGroupid(String groupid) {
        setAttribute(GROUPID, groupid);
    }


    /**
     * 從SESSION中取得學校代碼
     *
     * @return
     */
    public String getSchoolid() {
        return Optional.ofNullable((String) getAttribute(SCHOOLID))
                .orElse(Strings.EMPTY);
    }

    /**
     * 將使用者姓名儲存在SESSION
     *
     * @param trueName
     */
    public void setTrueName(String trueName) {
        setAttribute(TRUENAME, trueName);
    }

    /**
     * 將使用者姓名儲存在SESSION
     *
     * @return
     */
    public String getTrueName() {
        return Optional.ofNullable((String) getAttribute(TRUENAME))
                .orElse(Strings.EMPTY);
    }


    /**
     * 將使用者帳號儲存在SESSION
     *
     * @param username
     */
    public void setUsername(String username) {
        setAttribute(USERNAME, username);
    }

    /**
     * 從SESSION取出使用者帳號
     *
     * @return
     */
    public String getUsername() {
        return Optional.ofNullable((String) getAttribute(USERNAME))
                .orElse(Strings.EMPTY);
    }

    /**
     * 將使用者帳號儲存在SESSION
     *
     * @param user
     */
    public void setUid(User user) {
        setAttribute(UID, user.getId());
    }

    /**
     * 從SESSION取出使用者帳號
     *
     * @return
     */
    public Integer getUid() {
        return Optional.ofNullable((Integer) getAttribute(UID)).orElse(null);
    }

    /**
     * 將登入職稱儲存在SESSION
     *
     * @param titles
     */
    public void setTitles(String titles) {
        setAttribute(TITLES, titles);
    }

    /**
     * 從SESSION中取得登入帳號
     *
     * @return
     */
    public String getTitles() {
        return Optional.ofNullable((String) getAttribute(TITLES))
                .orElse(Strings.EMPTY);
    }

    /**
     * 將使用者角色儲存在SESSION
     *
     * @param roles
     */
    public void setRoleUser(List<String> roles) {
        setAttribute(ROLE, (Serializable) roles);
    }

    /**
     * 將使用者角色儲存在SESSION
     *
     * @return
     */
    public List<String> getRoleUsers() {
        return Optional.ofNullable((List<String>) getAttribute(ROLE))
                .orElse(Collections.emptyList());
    }
}
