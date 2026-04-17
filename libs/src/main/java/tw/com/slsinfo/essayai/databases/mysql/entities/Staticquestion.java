package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.utils.ComputationalThinking;

import java.time.Instant;


/**
 * CT問題向度
 */
@NamedQueries(
        {
                @NamedQuery(
                        name = NamedQueryNames.GET_QUESTIONS_BY_CT_TITLE,
                        query = "select sq from Staticquestion sq " +
                                "where sq.essaytitle = :title and sq.ctdimension = :ct"
                ),
                @NamedQuery(
                        name = NamedQueryNames.GET_QUESTIONS_BY_TITLE,
                        query = "select sq from Staticquestion sq " +
                                "where sq.essaytitle = :title"
                )
        })
@Entity
@Table(name = "staticquestions", schema = "aidb", indexes = {
        @Index(name = "staticquestions_essay_FK", columnList = "essaytitle")
})
public class Staticquestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "serial", nullable = false)
    private Integer id;

    @Size(max = 64)
    @NotNull
    @Column(name = "essaytitle", nullable = false, length = 64)
    private String essaytitle;

    @NotNull
    @Lob
    @Column(name = "ctdimension", nullable = false)
    private String ctdimension;

    @Size(max = 128)
    @NotNull
    @Column(name = "question", nullable = false, length = 128)
    private String question;

    @NotNull
    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "created", nullable = false, insertable = false, updatable = false)
    private Instant created;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getEssaytitle() {
        return essaytitle;
    }

    public void setEssaytitle(String essaytitle) {
        this.essaytitle = essaytitle;
    }

    public String getCtdimension() {
        return ctdimension;
    }

    public void setCtdimension(String ctdimension) {
        this.ctdimension = ctdimension;
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

    public ComputationalThinking getComputationalThinking() {
        return ComputationalThinking.valueOf(ctdimension);
    }

}