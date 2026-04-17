package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;

import java.io.Serializable;
import java.util.LinkedHashSet;
import java.util.Set;


@NamedQueries(
        {
                @NamedQuery(name = NamedQueryNames.GET_STAGE_BY_NAME,
                        query = "Select s from Stage s " +
                                "where s.stagename = :stagename"),
                @NamedQuery(name = NamedQueryNames.GET_ALL_STAGE,
                        query = "Select s from Stage s " +
                                "where s.llmtype = :llmtype" +
                                " and s.chattype = :chattype"),
                @NamedQuery(name = NamedQueryNames.GET_STAGE,
                        query = "Select s from Stage s " +
                                "where s.llmtype = :llmtype" )
        }
)
@Entity
@Table(name = "stage", schema = "aidb")
public class Stage implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @Size(max = 20)
    @Column(name = "llmtype", length = 20)
    private String llmtype;

    @Size(max = 30)
    @Column(name = "stagename", length = 30)
    private String stagename;

    @Size(max = 20)
    @Column(name = "chattype", length = 20)
    private String chattype;

    @Lob
    @Column(name = "systemprompt")
    private String systemprompt;

    @OneToMany(mappedBy = "stageid")
    private Set<Stagelog> stagelogs = new LinkedHashSet<>();

    @OneToMany(mappedBy = "stageid")
    private Set<Stagerecord> stagerecords = new LinkedHashSet<>();
    @OneToMany(mappedBy = "stageid")
    private Set<Classstageprompt> classstageprompts = new LinkedHashSet<>();
    @OneToMany(mappedBy = "stageid")
    private Set<Essayprompt> essayprompts = new LinkedHashSet<>();
    @OneToMany(mappedBy = "stageid")
    private Set<Step> steps = new LinkedHashSet<>();

    public Set<Stagerecord> getStagerecords() {
        return stagerecords;
    }

    public void setStagerecords(Set<Stagerecord> stagerecords) {
        this.stagerecords = stagerecords;
    }

    public Set<Classstageprompt> getClassstageprompts() {
        return classstageprompts;
    }

    public void setClassstageprompts(Set<Classstageprompt> classstageprompts) {
        this.classstageprompts = classstageprompts;
    }

    public Set<Essayprompt> getEssayprompts() {
        return essayprompts;
    }

    public void setEssayprompts(Set<Essayprompt> essayprompts) {
        this.essayprompts = essayprompts;
    }

    public Set<Step> getSteps() {
        return steps;
    }

    public void setSteps(Set<Step> steps) {
        this.steps = steps;
    }

    public Set<Stagelog> getStagelogs() {
        return stagelogs;
    }

    public void setStagelogs(Set<Stagelog> stagelogs) {
        this.stagelogs = stagelogs;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getLlmtype() {
        return llmtype;
    }

    public void setLlmtype(String llmtype) {
        this.llmtype = llmtype;
    }

    public String getStagename() {
        return stagename;
    }

    public void setStagename(String stagename) {
        this.stagename = stagename;
    }

    public String getChattype() {
        return chattype;
    }

    public void setChattype(String chattype) {
        this.chattype = chattype;
    }

    public String getSystemprompt() {
        return systemprompt;
    }

    public void setSystemprompt(String systemprompt) {
        this.systemprompt = systemprompt;
    }

}