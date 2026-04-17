package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.EJB;
import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.Composescore;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essay;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;
import tw.com.slsinfo.essayai.models.course.ComposeScoreModel;

import java.util.ArrayList;
import java.util.List;

/**
 * 實作 IComposeScoreRepository
 */
@Stateless
@Local(IComposeScoreRepository.class)
public class ComposeScoreRepositoryImpl implements IComposeScoreRepository {

    private static final Logger logger = LoggerFactory.getLogger(ComposeScoreRepositoryImpl.class);

    @Inject
    private IRDBCrudService<Composescore> composescoreIRDBCrudService;

    @Override
    public Composescore findId(int id) {
        return composescoreIRDBCrudService.find(Composescore.class, id);
    }

    @Override
    public Composescore referenceById(int id) {
        return composescoreIRDBCrudService.reference(Composescore.class, id);
    }

    @Override
    public Composescore updateEntity(Composescore composescore) {
        return composescoreIRDBCrudService.update(composescore);
    }

    @Override
    public List<Composescore> getComposescoreFilter(int ocid, int cid) {
        List<Operator> operators = new ArrayList<>();
        logger.debug("---------------getComposescoreFilter:{},{}",ocid,cid);
        operators.add(new Operator(Operator.Condition.EQ, "ocid.id", ocid));
        operators.add(new Operator(Operator.Condition.EQ, "cid.id", cid));

        return composescoreIRDBCrudService.dynamicQuery(Composescore.class, operators);
    }

    @Override
    public Composescore createEntity(Composescore composescore) {
        return composescoreIRDBCrudService.create(composescore);
    }
}
