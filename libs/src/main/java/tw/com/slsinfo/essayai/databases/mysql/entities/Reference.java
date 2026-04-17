package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;

@Entity
@Table(name = "`references`", schema = "aidb")
public class Reference {
    @Id
    @Column(name = "id", nullable = false)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ocid", nullable = false)
    private Openclass ocid;

    @Size(max = 150)
    @NotNull
    @Column(name = "sourcefilename", nullable = false, length = 150)
    private String sourcefilename;

    @Size(max = 100)
    @Column(name = "formatfilename", length = 100)
    private String formatfilename;

    @Column(name = "filesize")
    private Integer filesize;

    @Size(max = 100)
    @Column(name = "filepath", length = 100)
    private String filepath;

    @Size(max = 100)
    @Column(name = "contenttype", length = 100)
    private String contenttype;

    @NotNull
    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "created", nullable = false)
    private Instant created;

    @NotNull
    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "modified", nullable = false)
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

    public String getSourcefilename() {
        return sourcefilename;
    }

    public void setSourcefilename(String sourcefilename) {
        this.sourcefilename = sourcefilename;
    }

    public String getFormatfilename() {
        return formatfilename;
    }

    public void setFormatfilename(String formatfilename) {
        this.formatfilename = formatfilename;
    }

    public Integer getFilesize() {
        return filesize;
    }

    public void setFilesize(Integer filesize) {
        this.filesize = filesize;
    }

    public String getFilepath() {
        return filepath;
    }

    public void setFilepath(String filepath) {
        this.filepath = filepath;
    }

    public String getContenttype() {
        return contenttype;
    }

    public void setContenttype(String contenttype) {
        this.contenttype = contenttype;
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