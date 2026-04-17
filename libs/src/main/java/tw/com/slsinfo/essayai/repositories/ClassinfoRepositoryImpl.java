package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.*;
import tw.com.slsinfo.essayai.models.course.ClassinfoViewModel;

import java.util.ArrayList;
import java.util.List;

/**
 * 實作 ISchoolRepository
 */
@Stateless
@Local(IClassinfoRepository.class)
public class ClassinfoRepositoryImpl implements IClassinfoRepository {

    private static final Logger logger = LoggerFactory.getLogger(ClassinfoRepositoryImpl.class);

    @PersistenceContext
    private EntityManager entityManager;

    @Inject
    private IRDBCrudService<Classinfo> classinfoIRDBCrudService;

    @Override
    public Classinfo findId(int id) {
        return classinfoIRDBCrudService.find(Classinfo.class, id);
    }

    @Override
    public Classinfo referenceById(int id) {
        return classinfoIRDBCrudService.reference(Classinfo.class, id);
    }

    @Override
    public Classinfo updateEntity(Classinfo classinfo) {
        return classinfoIRDBCrudService.update(classinfo);
    }

    @Override
    public List<Classinfo> getStuClassinfoFilter(Integer sid, String llmtype) {
        return classinfoIRDBCrudService.findCacheableWithNamedQuery(NamedQueryNames.GET_STU_CLASSINFO_BY_SID
                , QueryParameterBuilder.start("sid", sid).with("llmtype", llmtype).build());
    }

    @Override
    public Classinfo getClassinfoById(int cid) {
        return null;
    }

    @Override
    public List<Classinfo> findAll() {
        return entityManager.createQuery(
                "SELECT c FROM Classinfo c " +
                        "LEFT JOIN FETCH c.uid " +
                        "ORDER BY c.grade, c.sclass, c.seatno",
                Classinfo.class).getResultList();
    }

    @Override
    public List<Classinfo> findBySchoolId(Integer sid) {
        return entityManager.createQuery(
                        "SELECT c FROM Classinfo c " +
                                "LEFT JOIN FETCH c.uid " +
                                "WHERE c.sid.id = :sid " +
                                "AND c.uid.id IN " +
                                "(SELECT r.uid.id FROM Roleuser r WHERE r.rid.id = 2) " +
                                "ORDER BY c.grade, c.sclass, c.seatno",
                        Classinfo.class)
                .setParameter("sid", sid)
                .getResultList();
    }

    @Override
    public List<String> findAllClassNames(Integer sid) {
        return entityManager.createQuery(
                        "SELECT DISTINCT c.classname " +
                                "FROM Classinfo c " +
                                "WHERE c.sid.id = :sid " +
                                "AND c.classname IS NOT NULL " +
                                "AND c.classname <> '' " +
                                "ORDER BY c.classname",
                        String.class)
                .setParameter("sid", sid)
                .getResultList();
    }

    @Override
    public List<Classinfo> findByClassname(Integer sid, String classname) {
        return entityManager.createQuery(
                        "SELECT c FROM Classinfo c " +
                                "LEFT JOIN FETCH c.uid " +
                                "WHERE c.sid.id = :sid " +
                                "AND c.classname = :classname " +
                                "ORDER BY c.seatno",
                        Classinfo.class)
                .setParameter("sid", sid)
                .setParameter("classname", classname)
                .getResultList();
    }

    @Override
    public Classinfo findById(Integer id) {
        return entityManager.find(Classinfo.class, id);
    }
}
