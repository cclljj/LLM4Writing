package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;

import java.io.Serializable;
import java.time.Instant;

@Entity
@Table(name = "stagerecord", schema = "aidb")
public class Stagerecord implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "cid", nullable = false)
    private Classinfo cid;

    @NotNull
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "stageid", nullable = false)
    private Stage stageid;

    @NotNull
    @ColumnDefault("1")
    @Column(name = "seq")
    private Integer seq;

    @Lob
    @Column(name = "content")
    private String content;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ocid")
    private Openclass ocid;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "created")
    private Instant created;

    @Size(max = 1)
    @NotNull
    @ColumnDefault("'0'")
    @Column(name = "istree", nullable = false, length = 1)
    private String istree;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "cgid")
    private Classgroup cgid;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Classinfo getCid() {
        return cid;
    }

    public void setCid(Classinfo cid) {
        this.cid = cid;
    }

    public Stage getStageid() {
        return stageid;
    }

    public void setStageid(Stage stageid) {
        this.stageid = stageid;
    }

    public Integer getSeq() {
        return seq;
    }

    public void setSeq(Integer seq) {
        this.seq = seq;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Openclass getOcid() {
        return ocid;
    }

    public void setOcid(Openclass ocid) {
        this.ocid = ocid;
    }

    public Instant getCreated() {
        return created;
    }

    public void setCreated(Instant created) {
        this.created = created;
    }

    public String getIstree() {
        return istree;
    }

    public void setIstree(String istree) {
        this.istree = istree;
    }

    public Classgroup getCgid() {
        return cgid;
    }

    public void setCgid(Classgroup cgid) {
        this.cgid = cgid;
    }

}