package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.time.Instant;

@Entity
@Table(name = "authpages", schema = "aidb", uniqueConstraints = {
        @UniqueConstraint(name = "authpages_unique", columnNames = {"component", "pkg"}),
        @UniqueConstraint(name = "authpages_unique_1", columnNames = {"menuname"})
})
public class Authpage extends SerializeModel {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @Size(max = 64)
    @NotNull
    @Column(name = "component", nullable = false, length = 64)
    private String component;

    @Size(max = 128)
    @NotNull
    @Column(name = "pkg", nullable = false, length = 128)
    private String pkg;

    @Size(max = 128)
    @NotNull
    @Column(name = "menuname", nullable = false, length = 128)
    private String menuname;

    @CreationTimestamp
    @Column(name = "created", nullable = false, updatable = false)
    private Instant created;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getComponent() {
        return component;
    }

    public void setComponent(String component) {
        this.component = component;
    }

    public String getPkg() {
        return pkg;
    }

    public void setPkg(String pkg) {
        this.pkg = pkg;
    }

    public String getMenuname() {
        return menuname;
    }

    public void setMenuname(String menuname) {
        this.menuname = menuname;
    }

    public Instant getCreated() {
        return created;
    }

    public void setCreated(Instant created) {
        this.created = created;
    }

}