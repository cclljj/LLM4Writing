package tw.com.slsinfo.essayai.databases.mysql;


import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.ejb.TransactionManagement;
import jakarta.ejb.TransactionManagementType;
import jakarta.persistence.*;
import jakarta.persistence.criteria.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;
import tw.com.slsinfo.commons.database.generic.OrderSpec;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.commons.io.IOConstants;

import java.util.*;

import static tw.com.slsinfo.commons.database.generic.Operator.Condition.*;


/**
 * Implementation for Service
 */
@Stateless
//因為有實作此Interface故需有此annotation
@Local(IRDBCrudService.class)
@TransactionManagement(TransactionManagementType.CONTAINER)
public class MySqlCrudServiceImpl<T> implements IRDBCrudService<T> {

    private static final Logger logger = LoggerFactory.getLogger(MySqlCrudServiceImpl.class);

    @PersistenceContext(name = "jndiWildfly")
    private EntityManager entityManager;

    public MySqlCrudServiceImpl() {
    }

    @Override
    public T create(T t) {
        this.entityManager.persist(t);
        this.entityManager.flush();
        this.entityManager.refresh(t);
        return t;
    }

    @Override
    @SuppressWarnings("unchecked")
    public T find(Class<T> type, Object id) {
        return (T) this.entityManager.find(type, id);
    }

    @Override
    public T find(Class<T> type, Object id, LockModeType lockModeType) {
        return (T) this.entityManager.find(type, id, lockModeType);
    }


    /**
     * https://vladmihalcea.com/manytoone-jpa-hibernate/
     *
     * @param type
     * @param id
     * @return
     */
    @Override
    public T reference(Class<T> type, Object id) {
        return (T) this.entityManager.getReference(type, id);
    }

    @Override
    public T update(T t) {
        return (T) this.entityManager.merge(t);
    }

    @Override
    public void delete(Class<T> type, Object id) {
        Object reference = this.entityManager.getReference(type, id);
        this.entityManager.remove(reference);
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<T> findWithNamedQuery(String queryName) {
//        logger.debug("Start Named Query : {}", queryName);
        return this.entityManager.createNamedQuery(queryName).getResultList();
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<T> findWithNamedQuery(String queryName, int resultLimit) {
        return this.entityManager.createNamedQuery(queryName).setMaxResults(resultLimit)
                .getResultList();
    }

    @Override
    public List<T> findWithNamedQuery(String namedQueryName, Map<String, Object> parameters) {
        return findWithNamedQuery(namedQueryName, parameters, -1);
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<T> findCacheableWithNamedQuery(String namedQueryName, Map<String, Object> parameters) {
        Query query = this.entityManager.createNamedQuery(namedQueryName);
        parameters.forEach(query::setParameter);
        return query.setHint(IOConstants.HIBERNATE_CACHEABLE, Boolean.TRUE).getResultList();
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<T> findWithNamedQuery(String namedQueryName, Map<String, Object> parameters, int resultLimit) {
        Query query = this.entityManager.createNamedQuery(namedQueryName);
        parameters.forEach(query::setParameter);
        if (resultLimit == -1) {
            return query.getResultList();
        } else {
            return query.setMaxResults(resultLimit).getResultList();
        }
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<T> createQuery(String query, Map<String, Object> parameters, int resultLimit) {
        Query jpqlquery = this.entityManager.createQuery(query);
        parameters.forEach(jpqlquery::setParameter);
        if (resultLimit == -1) {
            return jpqlquery.getResultList();
        } else {
            return jpqlquery.setMaxResults(resultLimit).getResultList();
        }
    }

    @Override
    public <T1> List<T1> createNamedQuery(String query, Map<String, Object> parameters, Class<T1> resultType) {
        TypedQuery<T1> q = this.entityManager.createNamedQuery(query, resultType);
        for (Map.Entry<String, Object> entry : parameters.entrySet()) {
            q.setParameter(entry.getKey(), entry.getValue());
        }
        return q.getResultList();
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<T> createQuery(String query, int resultLimit) {
        return this.entityManager.createQuery(query).setMaxResults(resultLimit).getResultList();
    }

    @Override
    public List<T> createQuery(String query, Map<String, Object> parameters) {
        return createQuery(query, parameters, -1);
    }


    @Override
    public List<T> findAll(Class<T> type) {
        return findAll(type, -1);
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<T> findAll(Class<T> type, int limits) {
        final String queryFindAll = "select e from ".concat(type.getSimpleName()).concat(" e");
        if (limits == -1) {
            return this.entityManager.createQuery(queryFindAll).getResultList();
        } else {
            return this.entityManager.createQuery(queryFindAll).setMaxResults(limits).getResultList();
        }
    }

    @Override
    public Number count(Class<T> type) {
        final String queryCountAll = "select count(e) from ".concat(type.getSimpleName()).concat(" e");
        return ((Number) this.entityManager.createQuery(queryCountAll).getSingleResult()).longValue();
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<T> createQuery(String query) {
        return this.entityManager.createQuery(query).getResultList();
    }

    @Override
    public boolean exists(Class<T> type, Object id) {
        return find(type, id) != null;
    }

    @Override
    public List<T> findWithNamedQuery(String namedQueryName, QueryParameterBuilder builder) {
        return findWithNamedQuery(namedQueryName, builder.toParameters());
    }

    @Override
    public List<T> findWithNamedQuery(String namedQueryName, QueryParameterBuilder builder, int resultLimit) {
        return findWithNamedQuery(namedQueryName, builder.toParameters(), resultLimit);
    }

    @Override
    public List<T> createQuery(String query, QueryParameterBuilder builder, int resultLimit) {
        return createQuery(query, builder.toParameters(), resultLimit);
    }

    @Override
    public List<T> createQuery(String query, QueryParameterBuilder builder) {
        return createQuery(query, builder.toParameters());
    }

    @Override
    public List<String> findColumnWithNameQuery(String namedQueryName, QueryParameterBuilder builder) {
        return findColumnWithNameQuery(namedQueryName, builder.toParameters(), -1);
    }

    @Override
    public List<String> findColumnWithNameQuery(String namedQueryName, Map<String, Object> parameters) {
        return findColumnWithNameQuery(namedQueryName, parameters, -1);
    }

    @Override
    public List<String> findColumnWithNameQuery(String namedQueryName, QueryParameterBuilder builder, int resultLimit) {
        return findColumnWithNameQuery(namedQueryName, builder.toParameters(), resultLimit);
    }

    @Override
    public List<String> findColumnWithNameQuery(String namedQueryName, Map<String, Object> parameters, int resultLimit) {
        Query jpqlquery = this.entityManager.createNamedQuery(namedQueryName, String.class);
        parameters.forEach(jpqlquery::setParameter);
        if (resultLimit == -1) {
            return jpqlquery.getResultList();
        } else {
            return jpqlquery.setMaxResults(resultLimit).getResultList();
        }
    }

    /**
     * https://www.baeldung.com/spring-data-jpa-query
     *
     * @param type
     * @param filters
     * @return
     */
    @Override
    public List<T> dynamicQuery(Class<T> type, List<Operator> filters) {
        return dynamicQuery(type, filters, null, null, null);
    }

    @Override
    public List<T> dynamicQuery(Class<T> type, List<Operator> filters, List<OrderSpec<T>> orders) {
        return dynamicQuery(type, filters, orders, null, null);
    }

    @Override
    public List<T> dynamicQuery(Class<T> type, List<Operator> filters, List<OrderSpec<T>> orders, Integer limit) {
        return dynamicQuery(type, filters, orders, null, limit);
    }

    @Override
    public List<T> dynamicQuery(Class<T> type, List<Operator> filters, List<OrderSpec<T>> orders, Integer first, Integer limit) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<T> query = cb.createQuery(type);
        Root<T> root = query.from(type);

        List<Predicate> predicates = new ArrayList<>();
        if (filters != null) {
            for (Operator filter : filters) {
                switch (filter.getOperator()) {
                    case EQ -> {
                        if (filter.getKey().contains(".")) {
                            String[] path = filter.getKey().split("\\."); //物件內的參數
                            Path<?> p = root.get(path[0]);
                            for (int i = 1; i < path.length; i++) {
                                p = p.get(path[i]);
                            }
                            predicates.add(cb.equal(p, filter.getValue()));
                        } else {
                            predicates.add(cb.equal(root.get(filter.getKey()), filter.getValue()));
                        }
                    }
                    case IN -> predicates.add(root.get(filter.getKey()).in((Collection<?>) filter.getValue()));
                    case LIKE -> predicates.add(cb.like(root.get(filter.getKey()), "%" + filter.getValue() + "%"));
                }
            }
        }

        query.select(root);

        // where 條件
        if (!predicates.isEmpty()) {
            query.where(predicates.toArray(new Predicate[0]));
        }


        // 排序處理
        if (orders != null && !orders.isEmpty()) {
            List<Order> jpaOrders = orders.stream()
                    .map(orderSpec -> orderSpec.toOrder(cb, root)).toList();
            query.orderBy(jpaOrders);
        }

        TypedQuery<T> typedQuery = entityManager.createQuery(query);


        // 只要 limit 幾筆
        if (limit != null) {
            typedQuery.setMaxResults(limit);
        }

        // 分頁處理
        if (first != null && limit != null) {
            typedQuery.setFirstResult(first);
            typedQuery.setMaxResults(limit);
        }


        return typedQuery.getResultList();
    }

    @Override
    public Long dynamicQueryCount(Class<T> type, List<Operator> filters) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Long> query = cb.createQuery(Long.class);
        Root<T> root = query.from(type);

        List<Predicate> predicates = new ArrayList<>();
        if (filters != null) {
            for (Operator filter : filters) {
                switch (filter.getOperator()) {
                    case EQ -> predicates.add(cb.equal(root.get(filter.getKey()), filter.getValue()));
                    case IN -> predicates.add(root.get(filter.getKey()).in((Collection<?>) filter.getValue()));
                    case LIKE -> predicates.add(cb.like(root.get(filter.getKey()), "%" + filter.getValue() + "%"));
                }
            }
        }

        query.select(cb.count(root));

        // where 條件
        if (!predicates.isEmpty()) {
            query.where(predicates.toArray(new Predicate[0]));
        }
        return entityManager.createQuery(query).getSingleResult();
    }

    @Override
    public List<T> dynamicQuery(Class<T> type, String joinColumn, JoinType joinType, List<Operator> joinFilters, List<Operator> filters) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<T> query = cb.createQuery(type);
        Root<T> root = query.from(type);
        Join<T, ?> join = root.join(joinColumn, joinType);
        List<Predicate> predicates = new ArrayList<>();
        joinFilters.forEach(jf -> {
            if (jf.getOperator().equals(EQ)) {
                predicates.add(cb.equal(join.get(jf.getKey()), jf.getValue()));
            } else if (jf.getOperator().equals(IN)) {
                predicates.add(join.get(jf.getKey()).in((Collection<?>) jf.getValue()));
            } else if (jf.getOperator().equals(LIKE)) {
                predicates.add(cb.like(join.get(jf.getKey()), "%" + jf.getValue() + "%"));
            }
        });
        filters.forEach(filter -> {
            if (filter.getOperator().equals(EQ)) {
                predicates.add(cb.equal(root.get(filter.getKey()), filter.getValue()));
            } else if (filter.getOperator().equals(IN)) {
                predicates.add(root.get(filter.getKey()).in((Collection<?>) filter.getValue()));
            } else if (filter.getOperator().equals(LIKE)) {
                predicates.add(cb.like(root.get(filter.getKey()), "%" + filter.getValue() + "%"));
            }
        });

        query.select(root).where(predicates.toArray(new Predicate[predicates.size()]));
        return entityManager.createQuery(query).getResultList();
    }


    @Override
    public Object procedureQuery(String procedureName, Map<String, Object> parameters, String out) {
        StoredProcedureQuery query = entityManager.createNamedStoredProcedureQuery(procedureName);
        for (String key : parameters.keySet()) {
            query.setParameter(key, parameters.get(key));
        }
        query.execute();
        return query.getOutputParameterValue(out);
    }

    @Override
    public Map<String, Object> procedureQuery(String procedureName, Map<String, Object> parameters, List<String> outKeys) {
        Map<String, Object> resultMap = new HashMap<>();

        try {
            StoredProcedureQuery query = entityManager.createStoredProcedureQuery(procedureName);

            // 設定 `IN` 參數
            for (Map.Entry<String, Object> entry : parameters.entrySet()) {
                query.registerStoredProcedureParameter(entry.getKey(), entry.getValue().getClass(), ParameterMode.IN);
                query.setParameter(entry.getKey(), entry.getValue());
            }

            // 設定 `OUT` 參數
            for (String outKey : outKeys) {
                query.registerStoredProcedureParameter(outKey, String.class, ParameterMode.OUT);
            }

            // 執行 Stored Procedure
            query.execute();

            // 取得 `OUT` 參數值
            for (String outKey : outKeys) {
                Object value = query.getOutputParameterValue(outKey);
                resultMap.put(outKey, value);
            }
        } catch (Exception e) {
            throw new RuntimeException("Stored Procedure error ：" + e.getMessage(), e);
        }

        return resultMap;
    }


    @Override
    public List<Object[]> nativeQueryMultipleEntity(String s, String s1) {
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
    public Integer deleteRecordWithNameQuery(String namedQueryName, Map<String, Object> parameters) {
        Query jpqlquery = this.entityManager.createNamedQuery(namedQueryName);
        parameters.forEach(jpqlquery::setParameter);
        return jpqlquery.executeUpdate();
    }

}

