package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "openclasses", schema = "aidb")
public class Openclass extends SerializeModel {
    @Id
    @Column(name = "id", nullable = false)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Size(max = 100)
    @NotNull
    @Column(name = "classname", nullable = false, length = 100)
    private String classname;

    @Column(name = "discussiontime")
    private Integer discussiontime;

    @Size(max = 1000)
    @Column(name = "supplementarytxt", length = 1000)
    private String supplementarytxt;

    @Size(max = 1)
    @ColumnDefault("'1'")
    @Column(name = "enable", length = 1)
    private String enable;

    @NotNull
    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "created", nullable = false)
    private Instant created;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "createduid")
    private User createduid;

    @NotNull
    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "modified", nullable = false)
    private Instant modified;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "modifieduid")
    private User modifieduid;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "eid")
    private Essay eid;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sid", nullable = false)
    private School sid;

    @Size(max = 20)
    @Column(name = "llmtype", length = 20)
    private String llmtype;


    public String getLlmtype() {
        return llmtype;
    }

    public void setLlmtype(String llmtype) {
        this.llmtype = llmtype;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getClassname() {
        return classname;
    }

    public void setClassname(String classname) {
        this.classname = classname;
    }

    public Integer getDiscussiontime() {
        return discussiontime;
    }

    public void setDiscussiontime(Integer discussiontime) {
        this.discussiontime = discussiontime;
    }

    public String getSupplementarytxt() {
        return supplementarytxt;
    }

    public void setSupplementarytxt(String supplementarytxt) {
        this.supplementarytxt = supplementarytxt;
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

    public User getCreateduid() {
        return createduid;
    }

    public void setCreateduid(User createduid) {
        this.createduid = createduid;
    }

    public Instant getModified() {
        return modified;
    }

    public void setModified(Instant modified) {
        this.modified = modified;
    }

    public User getModifieduid() {
        return modifieduid;
    }

    public void setModifieduid(User modifieduid) {
        this.modifieduid = modifieduid;
    }

    public Essay getEid() {
        return eid;
    }

    public void setEid(Essay eid) {
        this.eid = eid;
    }

    public School getSid() {
        return sid;
    }

    public void setSid(School sid) {
        this.sid = sid;
    }

}