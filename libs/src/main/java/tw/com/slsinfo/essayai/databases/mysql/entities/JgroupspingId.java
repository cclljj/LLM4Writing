package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.Hibernate;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class JgroupspingId  extends SerializeModel {
    private static final long serialVersionUID = -8931719478441438584L;
    @Size(max = 200)
    @NotNull
    @Column(name = "own_addr", nullable = false, length = 200)
    private String ownAddr;

    @Size(max = 200)
    @NotNull
    @Column(name = "cluster_name", nullable = false, length = 200)
    private String clusterName;

    public String getOwnAddr() {
        return ownAddr;
    }

    public void setOwnAddr(String ownAddr) {
        this.ownAddr = ownAddr;
    }

    public String getClusterName() {
        return clusterName;
    }

    public void setClusterName(String clusterName) {
        this.clusterName = clusterName;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || Hibernate.getClass(this) != Hibernate.getClass(o)) return false;
        JgroupspingId entity = (JgroupspingId) o;
        return Objects.equals(this.ownAddr, entity.ownAddr) &&
                Objects.equals(this.clusterName, entity.clusterName);
    }

    @Override
    public int hashCode() {
        return Objects.hash(ownAddr, clusterName);
    }

}