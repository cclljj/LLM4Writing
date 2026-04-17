package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;

/**
 * 寫作主題建立者預設System Prompt
 */
@Entity
@Table(name = "essayprompt", schema = "aidb")
@NamedQueries({
        @NamedQuery(
                name = "Essayprompt.findByEssayIdAndStageId",
                query = "SELECT e FROM Essayprompt e " +
                        "WHERE e.essayid.id = :essayid AND e.stageid.id = :stageid"
        )
})
public class Essayprompt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "essayid", nullable = false)
    private Essay essayid;

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

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Essay getEssayid() {
        return essayid;
    }

    public void setEssayid(Essay essayid) {
        this.essayid = essayid;
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

}