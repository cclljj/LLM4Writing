package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;



@NamedQueries({
        @NamedQuery(
                name = NamedQueryNames.FIND_ROLE_BY_ROLENAME,
                query = "select r from Role r where r.name = :rolename"
        ),
        @NamedQuery(
                name = NamedQueryNames.FIND_EXTRA_ROLE_GREAT_THAN_ROLEID,
                query = "select r from Role r where r.id > :roleid"
        ),
        @NamedQuery(
                name = NamedQueryNames.DELETE_ROLE_ROLEPERMISSION_CASCADE_BY_ROLE_ID,
                query = "delete from Rolepermission rp " +
                        "where rp.rid = :roleid"
        )
})
@Entity
@Table(name = "role", schema = "aidb", uniqueConstraints = {
        @UniqueConstraint(name = "role_unique", columnNames = {"name"})
})
public class Role extends SerializeModel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @Size(max = 50)
    @NotNull
    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @CreationTimestamp
    @Column(name = "created", nullable = false, updatable = false)
    private Instant created;

    @UpdateTimestamp
    @Column(name = "modified", nullable = false)
    private Instant modified;

    @OneToMany(mappedBy = "rid", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Roleuser> roleusers = new ArrayList<>();

    @OneToMany(mappedBy = "rid", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Rolepermission> rolepermissions = new LinkedHashSet<>();

    public Set<Rolepermission> getRolepermissions() {
        return rolepermissions;
    }

    public void setRolepermissions(Set<Rolepermission> rolepermissions) {
        this.rolepermissions = rolepermissions;
    }

    public Role addRoleuser(Roleuser roleuser) {
        roleusers.add(roleuser);
        roleuser.setRid(this);
        return this;
    }

    public Role removeRoleuser(Roleuser roleuser) {
        roleusers.remove(roleuser);
        roleuser.setRid(null);
        return this;
    }


    public Role() {
    }

    public Role(Integer id) {
        this.id = id;
    }

    public Role(String name) {
        this.name = name;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Instant getCreated() {
        return created;
    }

    public void setCreated(Instant created) {
        this.created = created;
    }

    public Instant getModified() {
        return modified;
    }

    public void setModified(Instant modified) {
        this.modified = modified;
    }

}