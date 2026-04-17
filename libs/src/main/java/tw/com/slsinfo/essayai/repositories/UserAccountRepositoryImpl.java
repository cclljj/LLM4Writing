package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.EJB;
import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.validation.constraints.NotNull;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.crypto.messagedigest.MDUtils;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 實作 IUserAccountRepository
 */
@Stateless
@Local(tw.com.slsinfo.essayai.repositories.IUserAccountRepository.class)
public class UserAccountRepositoryImpl implements tw.com.slsinfo.essayai.repositories.IUserAccountRepository {


    private static final Logger logger = LoggerFactory.getLogger(UserAccountRepositoryImpl.class);

    @EJB(name = "MySqlCrudServiceImpl")
    private IRDBCrudService<User> userCrudService;


    @Override
    public User creatUser(User user) {
        return userCrudService.create(user);
    }

    @Override
    public User referenceById(int id) {
        return userCrudService.reference(User.class, id);
    }

    @Override
    public User find(int id) {
        return userCrudService.find(User.class, id);
    }

    @Override
    public void updateUser(User user) {
        userCrudService.update(user);
    }

    @Override
    public boolean existsByAccount(String uid) {
        List<User> users = userCrudService.dynamicQuery(User.class, List.of(new Operator(Operator.Condition.EQ, "uid", uid)));
        return !users.isEmpty();
    }

    @Override
    public boolean existsByGuid(String guid) {
        return false;
    }


    @Override
    public boolean updateUserAccount(String oldAccount, String newAccount) {
        List<User> users = userCrudService.dynamicQuery(User.class, List.of(new Operator(Operator.Condition.EQ, "uid", oldAccount)));
        try {
            users.forEach(e -> {
                e.setUid(newAccount);
                userCrudService.update(e);
            });
            return true;
        } catch (Exception e) {
//            logger.debug(e.getMessage());
            return false;
        }
    }

    @Override
    public boolean updateUserGuid(String oldGuid, String spid, String newGuid) {
        return false;
    }

    @Override
    public List<User> getUser(List<String> uids, String username, String guid) {
        return List.of();
    }


    /**
     * {@inheritDoc}
     * @param uid 帳號
     * @return
     */
    @Override
    public User getUser(@NotNull String uid) {
        return userCrudService.dynamicQuery(User.class,
                List.of(new Operator(Operator.Condition.EQ, "uid", uid))).get(0);
    }

    @Override
    public List<User> doUserLogin(String uid, String password) {
        Optional<String> optionalPwd = MDUtils.getSHA256Hex(password);
        List<User> users = new ArrayList<>();
        if (optionalPwd.isEmpty()) {
            logger.debug("Cannot generate sha256 password for user : {}", uid);
            return users;
        } else {
//            logger.debug("user : {}, passwd:{}", uid, optionalPwd.orElse(""));
            return userCrudService.findWithNamedQuery(NamedQueryNames.DOLOGIN,
                    QueryParameterBuilder.start("uid", uid).with("passwd", optionalPwd.get()).build());

        }
    }

}
