package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "step", schema = "aidb")
public class Step {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // 加入這行
    @Column(name = "id", nullable = false)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stageid", nullable = false)
    private Stage stageid;


    @Size(max = 20)
    @Column(name = "stepname", length = 20)
    private String stepname;

    @Column(name = "stepsort")
    private Integer stepsort;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "created", nullable = false, insertable = false, updatable = false)
    private Instant created;

    /**
     * 問題型態
     * <ul>
     *     <li>0:固定問題</li>
     *     <li>1:AI prompt</li>
     * </ul>
     */
    @ColumnDefault("1")
    @Column(name = "type")
    private Boolean type;

    @OneToMany(mappedBy = "stepid")
    private Set<Essayquestion> essayquestions = new LinkedHashSet<>();

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Stage getStageid() {
        return stageid;
    }

    public void setStageid(Stage stageid) {
        this.stageid = stageid;
    }


    public String getStepname() {
        return stepname;
    }

    public void setStepname(String stepname) {
        this.stepname = stepname;
    }

    public Integer getStepsort() {
        return stepsort;
    }

    public void setStepsort(Integer stepsort) {
        this.stepsort = stepsort;
    }

    public Instant getCreated() {
        return created;
    }

    public void setCreated(Instant created) {
        this.created = created;
    }

    public Boolean getType() {
        return type;
    }

    public void setType(Boolean type) {
        this.type = type;
    }

    public Set<Essayquestion> getEssayquestions() {
        return essayquestions;
    }

    public void setEssayquestions(Set<Essayquestion> essayquestions) {
        this.essayquestions = essayquestions;
    }

}