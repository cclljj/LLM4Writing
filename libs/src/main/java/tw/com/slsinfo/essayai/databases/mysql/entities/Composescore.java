package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "composescore", schema = "aidb")
public class Composescore {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ocid", nullable = false)
    private Openclass ocid;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cid", nullable = false)
    private Classinfo cid;

    @Lob
    @Column(name = "compose")
    private String compose;

    @Column(name = "aiscore")
    private String aiscore;

    @Lob
    @Column(name = "aicomment")
    private String aicomment;

    @Column(name = "score")
    private String score;

    @Lob
    @Column(name = "comment")
    private String comment;


    @ColumnDefault("CURRENT_TIMESTAMP")
    @CreationTimestamp
    @Column(name = "created", nullable = false, insertable = false, updatable = false)
    private Instant created;


    @ColumnDefault("CURRENT_TIMESTAMP")
    @CreationTimestamp
    @Column(name = "modified", nullable = false, insertable = false, updatable = false)
    private Instant modified;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Openclass getOcid() {
        return ocid;
    }

    public void setOcid(Openclass ocid) {
        this.ocid = ocid;
    }

    public Classinfo getCid() {
        return cid;
    }

    public void setCid(Classinfo cid) {
        this.cid = cid;
    }

    public String getCompose() {
        return compose;
    }

    public void setCompose(String compose) {
        this.compose = compose;
    }

    public String getAiscore() {
        return aiscore;
    }

    public void setAiscore(String aiscore) {
        this.aiscore = aiscore;
    }

    public String getAicomment() {
        return aicomment;
    }

    public void setAicomment(String aicomment) {
        this.aicomment = aicomment;
    }

    public String getScore() {
        return score;
    }

    public void setScore(String score) {
        this.score = score;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
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