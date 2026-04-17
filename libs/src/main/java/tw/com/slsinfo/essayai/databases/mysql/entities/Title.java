package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;


@NamedQueries(
        @NamedQuery(
                name = NamedQueryNames.FIND_TITLE_BY_TITLENAME,
                query = "select t from Title t where t.name = :title"
        )
)
@Entity
@Table(name = "titles", schema = "aidb", uniqueConstraints = {
        @UniqueConstraint(name = "ctitles_unique", columnNames = {"name"})
})
public class Title {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @Size(max = 64)
    @NotNull
    @Column(name = "name", nullable = false, length = 64)
    private String name;

    @NotNull
    @ColumnDefault("CURRENT_TIMESTAMP")
    @CreationTimestamp
    @Column(name = "created", nullable = false, updatable = false)
    private Instant created;

    @OneToMany(mappedBy = "tid")
    private Set<Titlesmapping> titlesmappings = new LinkedHashSet<>();

    public Set<Titlesmapping> getTitlesmappings() {
        return titlesmappings;
    }

    public void setTitlesmappings(Set<Titlesmapping> titlesmappings) {
        this.titlesmappings = titlesmappings;
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

}