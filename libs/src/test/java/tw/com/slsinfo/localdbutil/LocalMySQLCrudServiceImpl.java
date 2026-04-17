package tw.com.slsinfo.localdbutil;


import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.Query;
import jakarta.persistence.criteria.JoinType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.ARDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;

import java.util.List;
import java.util.Map;

/**
 * AI DB Local CRUD
 *
 * @param <T>
 */
public class LocalMySQLCrudServiceImpl<T> extends ARDBCrudService<T> {

    private static final Logger logger = LoggerFactory.getLogger(LocalMySQLCrudServiceImpl.class);

    private EntityManager entityManager;

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public LocalMySQLCrudServiceImpl() {
        this.entityManager = LocalMySQLEntityManagerSingleton.INSTANCE.getEntityManager();
    }


    @Override
    public T create(T t) {
        entityManager.getTransaction().begin();
        try {
            this.entityManager.persist(t);
            this.entityManager.flush();
            this.entityManager.refresh(t);
            entityManager.getTransaction().commit();
        } catch (Exception e) {
            logger.debug(e.getMessage());
            entityManager.getTransaction().rollback();
        }
        return t;
    }

    @Override
    public T find(Class<T> type, Object id, LockModeType lockModeType) {
        return null;
    }

    @Override
    public T reference(Class<T> type, Object id) {
        return (T) this.entityManager.getReference(type, id);
    }

    @Override
    public List<T> dynamicQuery(Class<T> aClass, String s, JoinType joinType, List<Operator> list, List<Operator> list1) {
        return List.of();
    }

    @Override
    public List<Object> nativeQuery(String s, String s1) {
        return List.of();
    }

    @Override
    public List<Object> nativeQuery(String querystring, Map<String, Object> parameters) {
        return List.of();
    }

    @Override
    public Object procedureQuery(String s, Map<String, Object> map, String s1) {
        return null;
    }

    @Override
    public Map<String, Object> procedureQuery(String procedureName, Map<String, Object> parameters, List<String> outKey) {
        return Map.of();
    }

    @Override
    public List<Object[]> nativeQueryMultipleEntity(String s, String s1) {
        return List.of();
    }

    @Override
    public Integer deleteRecordWithNameQuery(String namedQueryName, Map<String, Object> parameters) {
        Query jpqlquery = this.entityManager.createNamedQuery(namedQueryName, String.class);
        parameters.forEach(jpqlquery::setParameter);
        return jpqlquery.executeUpdate();
    }
}
