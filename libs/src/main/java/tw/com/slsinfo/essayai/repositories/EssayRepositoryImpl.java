package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essay;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.Genre;
import tw.com.slsinfo.essayai.databases.mysql.entities.Openclass;

import java.util.ArrayList;
import java.util.List;

/**
 * 實作 ISchoolRepository
 */
@Stateless
@Local(IEssayRepository.class)
public class EssayRepositoryImpl implements IEssayRepository {

    private static final Logger logger = LoggerFactory.getLogger(EssayRepositoryImpl.class);


    @Inject
    private IRDBCrudService<Essay> essayIRDBCrudService;
    @Inject
    private IRDBCrudService<Genre> essayGenreIRDBCrudService;

    @Override
    public Essay findId(int id) {
        return essayIRDBCrudService.find(Essay.class, id);
    }

    @Override
    public Essay referenceById(int id) {
        return essayIRDBCrudService.reference(Essay.class, id);
    }

    @Override
    public Essay updateEntity(Essay essay) {
        return essayIRDBCrudService.update(essay);
    }

    @Override
    public List<Essay> getEssayFilter(String enable, String essay_title, Integer sid, String llmtype) {
        List<Operator> operators = new ArrayList<>();
        operators.add(new Operator(Operator.Condition.EQ, "sid.id", sid));
        operators.add(new Operator(Operator.Condition.EQ, "llmtype", llmtype));

        if (StringUtils.isNotEmpty(enable)) {
            operators.add(new Operator(Operator.Condition.EQ, "enable", enable));
        }
        if (StringUtils.isNotEmpty(essay_title)) {
            operators.add(new Operator(Operator.Condition.LIKE, "title", essay_title));
        }
        return essayIRDBCrudService.dynamicQuery(Essay.class, operators);
    }

    @Override
    public Essay getEssayById(int essay_id) {
        return essayIRDBCrudService.find(Essay.class, essay_id);
    }

    @Override
    public void createEssay(Essay essay) {
        essayIRDBCrudService.create(essay);
    }

    @Override
    public void deleteEssay(Integer eid) {
        essayIRDBCrudService.delete(Essay.class, eid);
    }
}
