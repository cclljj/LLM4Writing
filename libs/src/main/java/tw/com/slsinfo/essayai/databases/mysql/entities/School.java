package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;


@NamedQueries(
        @NamedQuery(
                name = NamedQueryNames.FIND_SCHOOL_BY_SCHOOLID,
                query = "select s from School s where s.sid = :schoolid"
        )
)
@Entity
@Table(name = "schools", schema = "aidb", indexes = {
        @Index(name = "schools_id_IDX", columnList = "id, sid")
})
public class School extends SerializeModel {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @Size(max = 10)
    @NotNull
    @Column(name = "sid", nullable = false, length = 10)
    private String sid;

    @Size(max = 64)
    @NotNull
    @Column(name = "fname", nullable = false, length = 64)
    private String fname;

    @ColumnDefault("'1'")
    @Column(name = "enable")
    private Character enable;


    @ColumnDefault("CURRENT_TIMESTAMP")
    @CreationTimestamp
    @Column(name = "created", nullable = false, insertable = false, updatable = false)
    private Instant created;


    @ColumnDefault("CURRENT_TIMESTAMP")
    @UpdateTimestamp
    @Column(name = "modified", nullable = false, insertable = false)
    private Instant modified;

    @OneToMany(mappedBy = "sid")
    private Set<Classinfo> classinfos = new LinkedHashSet<>();

    @OneToMany(mappedBy = "sid")
    private Set<Roleuser> roleusers = new LinkedHashSet<>();

    @OneToMany(mappedBy = "sid")
    private Set<Titlesmapping> titlesmappings = new LinkedHashSet<>();

    @OneToMany(mappedBy = "sid")
    private Set<Essay> essays = new LinkedHashSet<>();

    @OneToMany(mappedBy = "sid")
    private Set<Openclass> openclasses = new LinkedHashSet<>();

    public Set<Openclass> getOpenclasses() {
        return openclasses;
    }

    public void setOpenclasses(Set<Openclass> openclasses) {
        this.openclasses = openclasses;
    }

    public Set<Essay> getEssays() {
        return essays;
    }

    public void setEssays(Set<Essay> essays) {
        this.essays = essays;
    }

    public Set<Titlesmapping> getTitlesmappings() {
        return titlesmappings;
    }

    public void setTitlesmappings(Set<Titlesmapping> titlesmappings) {
        this.titlesmappings = titlesmappings;
    }

    public Set<Roleuser> getRoleusers() {
        return roleusers;
    }

    public void setRoleusers(Set<Roleuser> roleusers) {
        this.roleusers = roleusers;
    }

    public Set<Classinfo> getClassinfos() {
        return classinfos;
    }

    public void setClassinfos(Set<Classinfo> classinfos) {
        this.classinfos = classinfos;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getSid() {
        return sid;
    }

    public void setSid(String sid) {
        this.sid = sid;
    }

    public String getFname() {
        return fname;
    }

    public void setFname(String fname) {
        this.fname = fname;
    }

    public Character getEnable() {
        return enable;
    }

    public void setEnable(Character enable) {
        this.enable = enable;
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