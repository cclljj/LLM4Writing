package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.Title;
import tw.com.slsinfo.essayai.databases.mysql.entities.Titlesmapping;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Stateless
@Local(IUserTitlesRepository.class)
public class UserTitlesRepositoryImpl implements IUserTitlesRepository {

    @Inject
    private IRDBCrudService<Title> titleIRDBCrudService;

    @Inject
    private IRDBCrudService<Titlesmapping> titlesmappingIRDBCrudService;

    @Override
    public Title getStudentTitleName() {
        return getTitles("學生").get(0);
    }

    @Override
    public Title getTeacherTitleName() {
        return getTitles("教職員").get(0);
    }

    @Override
    public List<Title> getTitles(String titlename) {
        return titleIRDBCrudService.findWithNamedQuery(NamedQueryNames.FIND_TITLE_BY_TITLENAME,
                QueryParameterBuilder.start("title", titlename).build());
    }

    @Override
    public List<Titlesmapping> getUserTitles(String uid) {
        return titlesmappingIRDBCrudService.findWithNamedQuery(NamedQueryNames.GET_USER_TITLES_BY_UID,
                QueryParameterBuilder.start("uid", uid).build());
    }

    @Override
    public List<Titlesmapping> getUserTM(String uid, String schoolid) {
        Map<String, Object> map = new HashMap<>();
        map.put("uid", uid);
        map.put("sid", schoolid);
        return titlesmappingIRDBCrudService.findWithNamedQuery(NamedQueryNames.GET_USER_TITLES_BY_UID_SID
                , QueryParameterBuilder.build("uid", uid).with("sid", schoolid));
    }


}
