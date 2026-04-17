package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 寫作主題
 */
@Entity
@Table(name = "essay", schema = "aidb")
public class Essay {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @Size(max = 100)
    @NotNull
    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Size(max = 100)
    @Column(name = "etitle", length = 100)
    private String etitle;

    @Size(max = 1)
    @NotNull
    @ColumnDefault("'1'")
    @Column(name = "enable", nullable = false, length = 1)
    private String enable;

    @NotNull
    @ColumnDefault("CURRENT_TIMESTAMP")
    @CreationTimestamp
    @Column(name = "created", nullable = false, insertable = false, updatable = false)
    private Instant created;

    @NotNull
    @ColumnDefault("CURRENT_TIMESTAMP")
    @UpdateTimestamp
    @Column(name = "modified", nullable = false, insertable = false)
    private Instant modified;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "gid", nullable = false)
    private Genre gid;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sid")
    private School sid;

    @Lob
    @Column(name = "supplementarytxt")
    private String supplementarytxt;

    @OneToMany(mappedBy = "eid")
    private Set<Openclass> openclasses = new LinkedHashSet<>();

    @Size(max = 100)
    @Column(name = "llmtype", length = 100)
    private String llmtype;
    @OneToMany(mappedBy = "essayid")
    private Set<Essayprompt> essayprompts = new LinkedHashSet<>();
    @OneToMany(mappedBy = "essayid")
    private Set<Essayquestion> essayquestions = new LinkedHashSet<>();

    public String getLlmtype() {
        return llmtype;
    }

    public void setLlmtype(String llmtype) {
        this.llmtype = llmtype;
    }

    public Set<Essayprompt> getEssayprompts() {
        return essayprompts;
    }

    public void setEssayprompts(Set<Essayprompt> essayprompts) {
        this.essayprompts = essayprompts;
    }

    public Set<Essayquestion> getEssayquestions() {
        return essayquestions;
    }

    public void setEssayquestions(Set<Essayquestion> essayquestions) {
        this.essayquestions = essayquestions;
    }

    public Set<Openclass> getOpenclasses() {
        return openclasses;
    }

    public void setOpenclasses(Set<Openclass> openclasses) {
        this.openclasses = openclasses;
    }

    public String getSupplementarytxt() {
        return supplementarytxt;
    }

    public void setSupplementarytxt(String supplementarytxt) {
        this.supplementarytxt = supplementarytxt;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getEtitle() {
        return etitle;
    }

    public void setEtitle(String etitle) {
        this.etitle = etitle;
    }

    public String getEnable() {
        return enable;
    }

    public void setEnable(String enable) {
        this.enable = enable;
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

    public Genre getGid() {
        return gid;
    }

    public void setGid(Genre gid) {
        this.gid = gid;
    }

    public School getSid() {
        return sid;
    }

    public void setSid(School sid) {
        this.sid = sid;
    }


}