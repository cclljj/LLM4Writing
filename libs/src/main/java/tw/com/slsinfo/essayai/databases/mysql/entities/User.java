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
        {
                @NamedQuery(name = NamedQueryNames.DOLOGIN,
                        query = "Select u from User u where u.uid = :uid " +
                                "and u.password = :passwd"),
                @NamedQuery(name = NamedQueryNames.FIND_USER_BY_UID,
                        query = "select u from User u where u.uid = :uid")
        }
)
@Entity
@Table(name = "users", schema = "aidb", uniqueConstraints = {
        @UniqueConstraint(name = "users_unique", columnNames = {"uid"})
})
public class User extends SerializeModel {
    @Id
    @Column(name = "id", nullable = false)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Size(max = 24)
    @NotNull
    @Column(name = "uid", nullable = false, length = 24)
    private String uid;

    @Size(max = 64)
    @NotNull
    @Column(name = "name", nullable = false, length = 64)
    private String name;

    @Size(max = 64)
    @Column(name = "email", length = 64)
    private String email;

    @Size(max = 50)
    @Column(name = "mobile", length = 50)
    private String mobile;

    @CreationTimestamp
    @Column(name = "created", nullable = false, updatable = false)
    private Instant created;

    @UpdateTimestamp
    @Column(name = "modified", nullable = false)
    private Instant modified;

    @OneToMany(mappedBy = "uid", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Classinfo> classinfos = new LinkedHashSet<>();


    @OneToMany(mappedBy = "uid", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Roleuser> roleusers = new LinkedHashSet<>();

    @OneToMany(mappedBy = "uid", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<Titlesmapping> titlesmappings = new LinkedHashSet<>();

    @Size(max = 64)
    @NotNull
    @Column(name = "password", nullable = false, length = 64)
    private String password;

    @OneToMany
    @JoinColumn(name = "uid")
    private Set<Openclass> openclasses = new LinkedHashSet<>();

    public User() {

    }

    public User(Integer id, String uid, String name) {
        this.id = id;
        this.uid = uid;
        this.name = name;
    }

    public Set<Openclass> getOpenclasses() {
        return openclasses;
    }

    public void setOpenclasses(Set<Openclass> openclasses) {
        this.openclasses = openclasses;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public User addClassinfo(Classinfo classinfo) {
        classinfos.add(classinfo);
        classinfo.setUid(this);
        return this;
    }

    public User removeClassinfo(Classinfo classinfo) {
        classinfos.remove(classinfo);
        classinfo.setUid(null);
        return this;
    }

    public Set<Classinfo> getClassinfos() {
        return classinfos;
    }

    public User setClassinfos(Set<Classinfo> classinfos) {
        this.classinfos = classinfos;
        return this;
    }

    public User addRoleuser(Roleuser roleuser) {
        roleusers.add(roleuser);
        roleuser.setUid(this);
        return this;
    }

    public User removeRoleuser(Roleuser roleuser) {
        roleusers.remove(roleuser);
        roleuser.setUid(null);
        return this;
    }


    public User addTitlesmapping(Titlesmapping titlesmapping) {
        titlesmappings.add(titlesmapping);
        titlesmapping.setUid(this);
        return this;
    }

    public User removeTitlesmapping(Titlesmapping titlesmapping) {
        titlesmappings.remove(titlesmapping);
        titlesmapping.setUid(null);
        return this;
    }

    public Set<Titlesmapping> getTitlesmappings() {
        return titlesmappings;
    }

    public Set<Roleuser> getRoleusers() {
        return roleusers;
    }

    public void setRoleusers(Set<Roleuser> roleusers) {
        this.roleusers = roleusers;
    }

    public Instant getModified() {
        return modified;
    }

    public void setModified(Instant modified) {
        this.modified = modified;
    }


    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }


    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getMobile() {
        return mobile;
    }

    public void setMobile(String mobile) {
        this.mobile = mobile;
    }

    public Instant getCreated() {
        return created;
    }

    public void setCreated(Instant created) {
        this.created = created;
    }

    /**
     * 依職稱判定是否為教師<br>
     * 只要職稱為單一，且為「學生」，就是false，其餘為true
     *
     * @return
     */
    public boolean isTea() {
        if (titlesmappings.size() == 1 &&
                titlesmappings.stream().anyMatch(s -> s.getTid().getName().equals("學生"))) {
            return false;
        } else {
            return true;
        }
    }
}