package tw.com.slsinfo.essayai.utils;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Root;
import tw.com.slsinfo.commons.database.generic.OrderSpec;
import tw.com.slsinfo.essayai.databases.mysql.entities.Openclass;

public class SimpleOrderSpec<T> implements OrderSpec<T> {

    private final String fieldName;
    private final boolean ascending;

    /**
     * 建構子
     * @param fieldName 欄位名稱
     * @param ascending true=升冪(ASC), false=降冪(DESC)
     */
    public SimpleOrderSpec(String fieldName, boolean ascending) {
        this.fieldName = fieldName;
        this.ascending = ascending;
    }

    @Override
    public Order toOrder(CriteriaBuilder cb, Root<T> root) {
        if (ascending) {
            return cb.asc(root.get(fieldName));
        } else {
            return cb.desc(root.get(fieldName));
        }
    }

    // 靜態工廠方法 (選用,讓程式碼更簡潔)
    public static <T> SimpleOrderSpec<T> asc(String fieldName) {
        return new SimpleOrderSpec<>(fieldName, true);
    }

    public static <T> OrderSpec<Openclass> desc(String fieldName) {
        return new SimpleOrderSpec<>(fieldName, false);
    }
}