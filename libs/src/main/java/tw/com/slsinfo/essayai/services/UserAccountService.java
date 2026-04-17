package tw.com.slsinfo.essayai.services;

import com.unboundid.ldap.sdk.LDAPResult;
import com.unboundid.ldap.sdk.ResultCode;
import jakarta.ejb.Stateless;
import jakarta.enterprise.inject.spi.CDI;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import jakarta.validation.constraints.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.authentication.UserType;
import tw.com.slsinfo.commons.crypto.messagedigest.MDUtils;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;
import tw.com.slsinfo.essayai.databases.mysql.entities.Title;
import tw.com.slsinfo.essayai.databases.mysql.entities.Titlesmapping;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.essayai.models.wicket.ModifyUserDataModel;
import tw.com.slsinfo.essayai.models.wicket.UserInfoView;
import tw.com.slsinfo.essayai.models.wicket.school.SchoolInfoView;
import tw.com.slsinfo.essayai.repositories.IUserAccountRepository;
import tw.com.slsinfo.essayai.repositories.IUserTitlesRepository;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

import static java.util.stream.Collectors.groupingBy;

/**
 * 帳號管理
 */
@Stateless
public class UserAccountService {

    private static final Logger logger = LoggerFactory.getLogger(UserAccountService.class);

    @Inject
    private IUserAccountRepository iUserAccountRepository;

    @Inject
    private IUserTitlesRepository iUserTitlesRepository;


    public UserAccountService() {
    }


    /**
     * 查詢使用者 users 資料表資料
     *
     * @param uid 帳號
     * @return
     */
    public List<UserInfoView> getUserInfoViews(@NotNull String uid, @NotNull SchoolInfoView school) {
        List<UserInfoView> results = new ArrayList<>();
        iUserAccountRepository.getUser(Collections.singletonList(uid), null, null)
                .forEach(e -> {
                    results.add(UserInfoView.createNew(e, school));
                });
        return results;
    }

    /**
     * 查詢使用者 users 資料表資料
     *
     * @param uid 帳號
     * @return
     */
    public User getUser(@NotNull String uid) {
       return iUserAccountRepository.getUser(uid);
    }

    /**
     * 查詢使用者 users 資料表資料
     *
     * @param id 編號
     * @return
     */
    public User getUser(@NotNull Integer id) {
        User users = iUserAccountRepository.find(id);
        return users;
    }

    /**
     * 取得使用者真實姓名
     *
     * @param uid
     * @return
     */
    public String getTruename(@NotNull String uid) {
        List<User> users = iUserAccountRepository.getUser(Collections.singletonList(uid), null, null);
        if (users.isEmpty()) return null;
        else return users.get(0).getName();
    }


    public List<School> getUserSchool(@NotNull String uid) {
        return iUserTitlesRepository.getUserTitles(uid).stream().map(Titlesmapping::getSid).distinct().toList();
    }

    public List<Title> getUserTitles(@NotNull String uid) {
        return iUserTitlesRepository.getUserTitles(uid).stream().map(Titlesmapping::getTid).distinct().toList();
    }

    public List<String> getUserTitleString(@NotNull String uid) {
        return iUserTitlesRepository.getUserTitles(uid).stream().map(t -> t.getTid().getName()).distinct().toList();
    }

    /**
     * 帳密驗證
     */
    public List<User> doUserLogin(@NotNull String uid, @NotNull String password) {
        return iUserAccountRepository.doUserLogin(uid, password);
    }

    /**
     * 更新使用者資料
     */
    public void updateUser(@NotNull User user) {
        iUserAccountRepository.updateUser(user);
    }

}