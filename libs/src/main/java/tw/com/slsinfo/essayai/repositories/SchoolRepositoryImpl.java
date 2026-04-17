package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.EJB;
import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;

import java.util.ArrayList;
import java.util.List;

/**
 * 實作 ISchoolRepository
 */
@Stateless
@Local(ISchoolRepository.class)
public class SchoolRepositoryImpl implements ISchoolRepository {

    private static final Logger logger = LoggerFactory.getLogger(SchoolRepositoryImpl.class);


    @EJB(name = "MySqlCrudServiceImpl")
    private IRDBCrudService<School> schoolCrudService;

    @Override
    public School findId(int id) {
        return schoolCrudService.find(School.class, id);
    }

    @Override
    public School referenceById(int id) {
        return schoolCrudService.reference(School.class, id);
    }

    @Override
    public School updateEntity(School school) {
        return schoolCrudService.update(school);
    }

    @Override
    public List<School> getSchoolFilter(String enable, String schoolname, String sid) {
        List<Operator> operators = new ArrayList<>();
        if (StringUtils.isNotEmpty(enable)) {
            operators.add(new Operator(Operator.Condition.EQ, "enable", enable));
        }
        if (StringUtils.isNotEmpty(schoolname)) {
            operators.add(new Operator(Operator.Condition.LIKE, "fname", schoolname));
        }
        if (StringUtils.isNotEmpty(sid)) {
            operators.add(new Operator(Operator.Condition.EQ, "sid", sid));
        }
//        logger.debug("filter {}", operators);
        return schoolCrudService.dynamicQuery(School.class, operators);
    }

    /**
     * {@inheritDoc}
     *
     * @param schoolid
     * @return
     */
    @Override
    public List<School> getSchoolBySchoolId(String schoolid) {
        return schoolCrudService.findWithNamedQuery(NamedQueryNames.FIND_SCHOOL_BY_SCHOOLID,
                QueryParameterBuilder.start("schoolid", schoolid).build());
    }
}
