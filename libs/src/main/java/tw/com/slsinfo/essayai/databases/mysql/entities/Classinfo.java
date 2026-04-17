package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.models.course.ClassGroupMemberModel;
import tw.com.slsinfo.essayai.models.course.ClassinfoViewModel;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@NamedQueries(
        {
                @NamedQuery(name = NamedQueryNames.GET_STU_CLASSINFO_BY_SID,
                        query = "Select r from Classinfo r " +
                                "join fetch r.uid " +
                                "join fetch r.sid " +
                                "where r.grade != '0'" +
                                "and r.sid.id = :sid ")
        }
)

@Entity
@Table(name = "classinfo", schema = "aidb", indexes = {
        @Index(name = "classinfo_uid_IDX", columnList = "uid, sid")
})
public class Classinfo extends SerializeModel {
    @Id
    @Column(name = "id", nullable = false)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uid", nullable = false)
    private User uid;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sid", nullable = false)
    private School sid;

    @Size(max = 2)
    @NotNull
    @ColumnDefault("''")
    @Column(name = "grade", nullable = false, length = 2)
    private String grade;

    @Size(max = 2)
    @NotNull
    @ColumnDefault("''")
    @Column(name = "sclass", nullable = false, length = 2)
    private String sclass;

    @Size(max = 2)
    @NotNull
    @ColumnDefault("''")
    @Column(name = "seatno", nullable = false, length = 2)
    private String seatno;

    @Size(max = 12)
    @NotNull
    @ColumnDefault("''")
    @Column(name = "sno", length = 12)
    private String sno;

    @Size(max = 30)
    @NotNull
    @ColumnDefault("''")
    @Column(name = "classname", nullable = false, length = 30)
    private String classname;

    @NotNull
    @CreationTimestamp
    @Column(name = "created", nullable = false, updatable = false)
    private Instant created;

    @NotNull
    @UpdateTimestamp
    @Column(name = "modified", nullable = false)
    private Instant modified;

    @OneToMany
    @JoinColumn(name = "member_cid")
    private Set<Classgroupmember> classgroupmembers = new LinkedHashSet<>();

    @OneToMany(mappedBy = "cid")
    private Set<Stagelog> stagelogs = new LinkedHashSet<>();

    @OneToMany(mappedBy = "cid")
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

    public Classinfo() {

    }

    public Set<Classgroupmember> getClassgroupmembers() {
        return classgroupmembers;
    }

    public void setClassgroupmembers(Set<Classgroupmember> classgroupmembers) {
        this.classgroupmembers = classgroupmembers;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public User getUid() {
        return uid;
    }

    public void setUid(User uid) {
        this.uid = uid;
    }

    public School getSid() {
        return sid;
    }

    public void setSid(School sid) {
        this.sid = sid;
    }

    public String getGrade() {
        return grade;
    }

    public void setGrade(String grade) {
        this.grade = grade;
    }

    public String getSclass() {
        return sclass;
    }

    public void setSclass(String sclass) {
        this.sclass = sclass;
    }

    public String getSeatno() {
        return seatno;
    }

    public void setSeatno(String seatno) {
        this.seatno = seatno;
    }

    public String getSno() {
        return sno;
    }

    public void setSno(String sno) {
        this.sno = sno;
    }

    public String getClassname() {
        return classname;
    }

    public void setClassname(String classname) {
        this.classname = classname;
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