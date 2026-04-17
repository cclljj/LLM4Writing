package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.enterprise.inject.spi.CDI;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import tw.com.slsinfo.essayai.models.course.ClassGroupModel;
import tw.com.slsinfo.essayai.services.GroupManageService;
import tw.com.slsinfo.essayai.services.OpenclassService;

import java.io.Serializable;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "classgroups", schema = "aidb")
public class Classgroup implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ocid", nullable = false)
    private Openclass ocid;

    @Size(max = 64)
    @NotNull
    @Column(name = "groupname", nullable = false, length = 64)
    private String groupname;

    @NotNull
    @Column(name = "created", nullable = false)
    private Instant created;

    @NotNull
    @Column(name = "modified", nullable = false)
    private Instant modified;

    @OneToMany(mappedBy = "cgid", fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    private Set<Classgroupmember> classgroupmembers = new LinkedHashSet<>();

    @OneToMany
    @JoinColumn(name = "cgid")
    private Set<Stagelog> stagelogs = new LinkedHashSet<>();

    @OneToMany
    @JoinColumn(name = "cgid")
    private Set<Stagerecord> stagerecords = new LinkedHashSet<>();

    public Set<Stagerecord> getStagerecords() {
        return stagerecords;
    }

    public void setStagerecords(Set<Stagerecord> stagerecords) {
        this.stagerecords = stagerecords;
    }

    public Set<Stagelog> getStagelogs() {
        return stagelogs;
    }

    public void setStagelogs(Set<Stagelog> stagelogs) {
        this.stagelogs = stagelogs;
    }


    public Classgroup() {

    }

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

    public String getGroupname() {
        return groupname;
    }

    public void setGroupname(String groupname) {
        this.groupname = groupname;
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

    public Set<Classgroupmember> getClassgroupmembers() {
        return classgroupmembers;
    }

    public void setClassgroupmembers(Set<Classgroupmember> classgroupmembers) {
        this.classgroupmembers = classgroupmembers;
    }

    public Classgroup(Openclass ocid, String groupname) {
        this.ocid = ocid;
        this.groupname = groupname;
    }


}