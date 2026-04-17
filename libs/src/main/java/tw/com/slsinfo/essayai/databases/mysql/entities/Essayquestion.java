package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.ColumnDefault;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;

import java.time.Instant;


/**
 * 寫作主題對應1,2,4階段AI詢問問題
 */
@NamedQueries(
        {
                @NamedQuery(name = NamedQueryNames.GET_STAGE_QUESTIONS_BY_IDS,
                        query = "Select e from Essayquestion e " +
                                "join fetch e.essayid " +
                                "join fetch e.stepid " +
                                "join fetch e.stepid.stageid " +
                                "where e.essayid.id = :essayId and e.stepid.stageid.id = :stageId " +
                                "order by e.stepid.stepsort, e.id"),
                @NamedQuery(name = NamedQueryNames.GET_STAGE_QUESTIONS_BY_EID,
                        query = "SELECT eq FROM Essayquestion eq " +
                                "LEFT JOIN FETCH eq.stepid " +
                                "join fetch eq.stepid.stageid " +
                                "WHERE eq.essayid.id = :essayId " +
                                "ORDER BY eq.stepid.stepsort, eq.id")
        }
)
@Entity
@Table(name = "essayquestions", schema = "aidb")
public class Essayquestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // 加入這行
    @Column(name = "id", nullable = false)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "essayid", nullable = false)
    private Essay essayid;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "stepid", nullable = false)
    private Step stepid;

    @NotNull
    @Lob
    @Column(name = "question", nullable = false)
    private String question;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "created", insertable = false, updatable = false, nullable = false)
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

    public Step getStepid() {
        return stepid;
    }

    public void setStepid(Step stepid) {
        this.stepid = stepid;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public Instant getCreated() {
        return created;
    }

    public void setCreated(Instant created) {
        this.created = created;
    }

}