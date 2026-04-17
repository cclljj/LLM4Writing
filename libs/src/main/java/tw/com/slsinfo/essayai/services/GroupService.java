package tw.com.slsinfo.essayai.services;

import jakarta.ejb.Stateless;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.validation.constraints.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroupmember;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.essayai.repositories.IClassgroupMemberRepository;
import tw.com.slsinfo.essayai.repositories.IRoleUserRepository;
import tw.com.slsinfo.essayai.repositories.ISchoolRepository;
import tw.com.slsinfo.essayai.repositories.IUserAccountRepository;

import java.util.ArrayList;
import java.util.List;

/**
 * 小組管理
 */
@ApplicationScoped
public class GroupService {
    private static final Logger logger = LoggerFactory.getLogger(GroupService.class);

    @Inject
    private IRoleUserRepository iRoleUserRepository;

    @Inject
    private ISchoolRepository iSchoolRepository;

    @Inject
    private IUserAccountRepository iUserAccountRepository;

    @Inject
    private IClassgroupMemberRepository iClassgroupMemberRepository;

    /**
     * 取得分組ID，用來做小組聊天用，同一位學生可能會會有多個分組
     *
     * @param uid
     * @return
     */
    public List<Integer> getGroupIds(@NotNull String uid) {
        User user = iUserAccountRepository.getUser(uid);
        List<Integer> groupIds = new ArrayList<>();
        if (user != null) {
            List<Classgroupmember> classgroupmembers = iClassgroupMemberRepository.findByUid(user);
            if (!classgroupmembers.isEmpty()) {
                classgroupmembers.forEach(classgroupmember -> {
                    groupIds.add(classgroupmember.getCgid().getId());
                });
            }
        }
        return groupIds;
    }


}
