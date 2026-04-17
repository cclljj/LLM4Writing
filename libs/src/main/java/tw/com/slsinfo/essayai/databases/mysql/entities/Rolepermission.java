package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;


@NamedQueries(
        {
                @NamedQuery(
                        name = NamedQueryNames.FIND_ROLE_BY_COMPONENTCLASSNAME,
                        query = "select rp from Rolepermission rp " +
                                "join fetch rp.rid  where rp.component = :component"
                ),
                @NamedQuery(
                        name = NamedQueryNames.FIND_ROLEPERMISSION_BY_ROLEID,
                        query = "select rp from Rolepermission rp " +
                                "join fetch rp.rid where rp.rid = :roleid"
                ),
                @NamedQuery(
                        name = NamedQueryNames.FIND_ROLEPERMISSION_BY_ROLEIDS,
                        query = "select rp from Rolepermission rp " +
                                "join fetch rp.rid where rp.rid in :roleids"
                ),
                @NamedQuery(
                        name = NamedQueryNames.FIND_EXTRA_ROLEPERMISSION_BY_ROLEID,
                        query = "select rp from Rolepermission rp " +
                                "join fetch rp.rid where rp.builtin = :builtin and rp.rid in :roleids"
                ),
                @NamedQuery(
                        name = NamedQueryNames.FIND_EXTRA_ROLEPERMISSION_BY_BUILTIN,
                        query = "select rp from Rolepermission rp " +
                                "join fetch rp.rid where rp.builtin = :builtin"
                ),
                @NamedQuery(
                        name = NamedQueryNames.FIND_DISTINCT_ROLEPERMISSION_BY_BUILTIN,
                        query = "select distinct(rp.rid) from Rolepermission rp " +
                                "join rp.rid where rp.builtin = :builtin"
                ),
                @NamedQuery(
                        name = NamedQueryNames.DELETE_ROLEPERMISSION_BY_ROLE_ID,
                        query = "delete from Rolepermission rp where rp.rid.id =: roleid"
                )
        }
)

@Entity
@Table(name = "rolepermissions", schema = "aidb", uniqueConstraints = {
        @UniqueConstraint(name = "rolepermissions_unique", columnNames = {"rid", "component"})
})
public class Rolepermission extends SerializeModel {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "rid", nullable = false)
    private Role rid;

    @Size(max = 64)
    @NotNull
    @Column(name = "component", nullable = false, length = 64)
    private String component;

    @Size(max = 256)
    @Column(name = "pkg", nullable = false, length = 256)
    private String pkg;

    @Size(max = 128)
    @Column(name = "context", length = 128)
    private String context;

    @Size(max = 100)
    @NotNull
    @Column(name = "menuname", nullable = false, length = 100)
    private String menuname;

    @NotNull
    @ColumnDefault("0")
    @Column(name = "builtin", nullable = false)
    private Boolean builtin = false;

    public Boolean getBuiltin() {
        return builtin;
    }

    public void setBuiltin(Boolean builtin) {
        this.builtin = builtin;
    }

    public String getMenuname() {
        return menuname;
    }

    public void setMenuname(String menuname) {
        this.menuname = menuname;
    }

    public String getContext() {
        return context;
    }

    public void setContext(String context) {
        this.context = context;
    }

    public String getPkg() {
        return pkg;
    }

    public void setPkg(String pkg) {
        this.pkg = pkg;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Role getRid() {
        return rid;
    }

    public void setRid(Role rid) {
        this.rid = rid;
    }

    public String getComponent() {
        return component;
    }

    public void setComponent(String component) {
        this.component = component;
    }

}


