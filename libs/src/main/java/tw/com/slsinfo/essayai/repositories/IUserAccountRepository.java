package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.validation.constraints.NotNull;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;

import java.util.List;

/**
 * 帳號管理 (師生)
 */
@Local
public interface IUserAccountRepository {

    /**
     * 建立帳號
     */
    User creatUser(User user);

    /**
     * 取的 User
     *
     * @param id
     * @return
     */
    User referenceById(int id);

    /**
     * 取的 User
     *
     * @param id
     * @return
     */
    User find(int id);

    /**
     * 更新 User
     *
     * @param user
     */
    void updateUser(User user);

    /**
     * 確認帳號是否存在
     *
     * @param uid
     * @return
     */
    boolean existsByAccount(@NotNull String uid);


    /**
     * 確認身分證SHA256是否存在
     *
     * @param guid
     * @return
     */
    boolean existsByGuid(@NotNull String guid);

    /**
     * 更換使用者 UID
     *
     * @param oldAccount
     * @param newAccount
     * @return
     */
    boolean updateUserAccount(@NotNull String oldAccount, @NotNull String newAccount);

    /**
     * 更換使用者 GUID
     *
     * @param oldGuid
     * @param spid
     * @param newGuid
     * @return
     */
    boolean updateUserGuid(@NotNull String oldGuid, @NotNull String spid, @NotNull String newGuid);

    /**
     * 取User資料
     *
     * @param uids     帳號
     * @param username 姓名
     * @param guid     身分證字號SHA256
     * @return
     */
    List<User> getUser(@NotNull List<String> uids, String username, String guid);


    /**
     * 取User資料
     *
     * @param uid 帳號
     * @return
     */
    User getUser(@NotNull String uid);

    /**
     * 帳密驗證
     *
     * @param uid
     * @param password
     * @return
     */
    List<User> doUserLogin(@NotNull String uid, @NotNull String password);

}
