package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.persistence.*;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroup;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroupmember;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essay;

import java.util.ArrayList;
import java.util.List;

/**
 * 實作 ISchoolRepository
 */
@Stateless
@Local(IClassgroupRepository.class)
public class ClassgroupRepositoryImpl implements IClassgroupRepository {

    private static final Logger logger = LoggerFactory.getLogger(ClassgroupRepositoryImpl.class);

    @PersistenceContext
    private EntityManager entityManager;

    @Inject
    private IRDBCrudService<Classgroup> ClassgroupIRDBCrudService;

    @Override
    public Classgroup findId(int id) {
        return ClassgroupIRDBCrudService.find(Classgroup.class, id);
    }

    @Override
    public Classgroup referenceById(int id) {
        return ClassgroupIRDBCrudService.reference(Classgroup.class, id);
    }

    @Override
    public Classgroup updateEntity(Classgroup Classgroup) {
        return ClassgroupIRDBCrudService.update(Classgroup);
    }

    @Override
    public List<Classgroup> getClassgroupFilter(Integer ocid) {
        List<Operator> operators = new ArrayList<>();
        operators.add(new Operator(Operator.Condition.EQ, "ocid.id", ocid));
        return ClassgroupIRDBCrudService.dynamicQuery(Classgroup.class, operators);
    }

    @Override
    public boolean existsByOcid(Integer ocid) {
        try {
            List<Operator> operators = new ArrayList<>();
            operators.add(new Operator(Operator.Condition.EQ, "ocid.id", ocid));
            int count = ClassgroupIRDBCrudService.dynamicQuery(Classgroup.class, operators).size();

            return count > 0;
        } catch (Exception e) {
            logger.debug("檢查分組存在失敗，ocid: {}", ocid, e);
            return false;
        }
    }

    @Override
    public List<Classgroup> findByOcid(Integer ocid) {
//        return entityManager.createQuery(
//                        "SELECT g FROM Classgroup g WHERE g.ocid.id = :ocid ORDER BY g.groupname",
//                        Classgroup.class)
//                .setParameter("ocid", ocid)
//                .getResultList();
        if (ocid == null) {
            return new ArrayList<>();
        }

        try {
            // 建立 EntityGraph
            EntityGraph<Classgroup> entityGraph = entityManager.createEntityGraph(Classgroup.class);

            // 定義要預先載入的關聯路徑
            Subgraph<Classgroupmember> membersSubgraph = entityGraph.addSubgraph("classgroupmembers");
            Subgraph<Classinfo> classinfoSubgraph = membersSubgraph.addSubgraph("memberCid");
            classinfoSubgraph.addSubgraph("uid");

            String jpql = "SELECT DISTINCT g FROM Classgroup g WHERE g.ocid.id = :ocid ORDER BY g.groupname";

            TypedQuery<Classgroup> query = entityManager.createQuery(jpql, Classgroup.class);
            query.setParameter("ocid", ocid);

            // 使用 EntityGraph
            query.setHint("javax.persistence.fetchgraph", entityGraph);

            return query.getResultList();

        } catch (Exception e) {
            logger.debug("載入組別資料時發生錯誤，ocid: {}", ocid, e);
            return new ArrayList<>();
        }
    }


    @Override
    public Classgroup findById(Integer id) {
        return entityManager.find(Classgroup.class, id);
    }

    @Override
    public void save(Classgroup Classgroup) {
        if (Classgroup.getId() == null) {
            entityManager.persist(Classgroup);
        } else {
            entityManager.merge(Classgroup);
        }
    }

    @Override
    public void delete(Classgroup Classgroup) {
        Classgroup managedGroup = entityManager.contains(Classgroup) ? Classgroup : entityManager.merge(Classgroup);
        entityManager.remove(managedGroup);
    }

    @Override
    public boolean existsByIdAndOcid(Integer groupId, Integer ocid) {
        return false;
    }
}
