package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;


/**
 * 開課教師指定System Prompt
 */
@Entity
@Table(name = "classstageprompt", schema = "aidb")
@NamedQueries({
        @NamedQuery(
                name = "Classstageprompt.findByOcidAndStageId",
                query = "SELECT c FROM Classstageprompt c " +
                        "WHERE c.ocid.id = :ocid AND c.stageid.id = :stageid"
        )
})
public class Classstageprompt {
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
    @JoinColumn(name = "stageid", nullable = false)
    private Stage stageid;

    @Lob
    @Column(name = "prompt")
    private String prompt;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "created")
    private Instant created;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "modified")
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

    public Stage getStageid() {
        return stageid;
    }

    public void setStageid(Stage stageid) {
        this.stageid = stageid;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
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