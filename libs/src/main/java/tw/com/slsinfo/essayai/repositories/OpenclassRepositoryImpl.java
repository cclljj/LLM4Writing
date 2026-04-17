package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.persistence.criteria.Order;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;
import tw.com.slsinfo.commons.database.generic.OrderSpec;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.entities.Openclass;
import tw.com.slsinfo.essayai.models.course.OpenClassModel;
import tw.com.slsinfo.essayai.models.course.OpenClassesView;
import tw.com.slsinfo.essayai.utils.SimpleOrderSpec;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 實作 IOpenclassRepository
 */
@Stateless
@Local(IOpenclassRepository.class)
public class OpenclassRepositoryImpl implements IOpenclassRepository {

    private static final Logger logger = LoggerFactory.getLogger(OpenclassRepositoryImpl.class);


    @Inject
    private IRDBCrudService<Openclass> openclassCrudService;

    @Override
    public Openclass findId(int id) {
        return openclassCrudService.find(Openclass.class, id);
    }

    @Override
    public Openclass referenceById(int id) {
        return openclassCrudService.reference(Openclass.class, id);
    }


    @Override
    public Openclass updateEntity(Openclass openclass) {
        return openclassCrudService.update(openclass);
    }

    @Override
    public void createOpenclass(Openclass openclass) {
        openclassCrudService.create(openclass);
    }

    @Override
    public List<Openclass> getOpenClassFilter(Integer sid, String enable, String classname, Integer eid, String llmtype) {
        List<Operator> operators = new ArrayList<>();
        operators.add(new Operator(Operator.Condition.EQ, "sid.id", sid));
        operators.add(new Operator(Operator.Condition.EQ, "llmtype", llmtype));
        if (StringUtils.isNotEmpty(enable)) {
            operators.add(new Operator(Operator.Condition.EQ, "enable", enable));
        }
        if (StringUtils.isNotEmpty(classname)) {
            operators.add(new Operator(Operator.Condition.EQ, "classname", classname));
        }
        if (eid != null && eid > 0) {
            operators.add(new Operator(Operator.Condition.EQ, "eid.id", eid));
        }
        // 加上排序條件：按 id 降序排列
        List<OrderSpec<Openclass>> orders = new ArrayList<>();
        orders.add(SimpleOrderSpec.desc("id")); // 降冪

        return openclassCrudService.dynamicQuery(Openclass.class, operators, orders);
    }


    @Override
    public List<Openclass> getOpenClassFilter(Integer sid, Integer uid, String enable, String llmtype) {
        List<Operator> operators = new ArrayList<>();
        operators.add(new Operator(Operator.Condition.EQ, "sid.id", sid));
        operators.add(new Operator(Operator.Condition.EQ, "createduid.id", uid));
        operators.add(new Operator(Operator.Condition.EQ, "llmtype", llmtype));
        if (StringUtils.isNotEmpty(enable)) {
            operators.add(new Operator(Operator.Condition.EQ, "enable", enable));
        }

        // 使用 SimpleOrderSpec
        List<OrderSpec<Openclass>> orders = new ArrayList<>();
        orders.add(SimpleOrderSpec.desc("created")); // 降冪

        return openclassCrudService.dynamicQuery(Openclass.class, operators, orders);
    }

    @Override
    public Openclass getOpenClassOne(int ocid) {
        List<Operator> operators = new ArrayList<>();
        operators.add(new Operator(Operator.Condition.EQ, "id", ocid));
        return openclassCrudService.dynamicQuery(Openclass.class, operators).get(0);
    }

    @Override
    public void deleteOpenclass(int id) {
        openclassCrudService.delete(Openclass.class, id);
    }

    @Override
    public Openclass save(Openclass openclass) {
        return null;
    }

    @Override
    public void delete(Openclass openclass) {

    }

    @Override
    public List<Openclass> findAllEnabled() {
        return List.of();
    }
}
