package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "genre", schema = "aidb")
public class Genre extends SerializeModel {
    @Id
    @Column(name = "id", nullable = false)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "created")
    private Instant created;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "modified")
    private Instant modified;

    @Size(max = 100)
    @Column(name = "llmtype", length = 100)
    private String llmtype;

    @Size(max = 100)
    @NotNull
    @Column(name = "genre", nullable = false, length = 100)
    private String genre;

    @OneToMany(mappedBy = "gid")
    private Set<Essay> essays = new LinkedHashSet<>();

    public Set<Essay> getEssays() {
        return essays;
    }

    public void setEssays(Set<Essay> essays) {
        this.essays = essays;
    }

    public String getGenre() {
        return genre;
    }

    public void setGenre(String genre) {
        this.genre = genre;
    }

    public Genre() {

    }

    public String getLlmtype() {
        return llmtype;
    }

    public void setLlmtype(String llmtype) {
        this.llmtype = llmtype;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
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