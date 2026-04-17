package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;

import java.time.Instant;

@NamedQueries({
        @NamedQuery(
                name = NamedQueryNames.GET_USER_TITLES_BY_UID,
                query = "select t from Titlesmapping t " +
                        "join fetch t.uid " +
                        "join fetch t.sid " +
                        "where t.uid.uid = :uid"
        ),
        @NamedQuery(
                name = NamedQueryNames.GET_USER_TITLES_BY_UID_SID,
                query = "select t from Titlesmapping t " +
                        "join fetch t.uid " +
                        "join fetch t.sid " +
                        "join fetch t.tid " +
                        "where t.uid.uid = :uid and t.sid.sid = :sid")
})
@Entity
@Table(name = "titlesmapping", schema = "aidb")
public class Titlesmapping {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uid", nullable = false)
    private User uid;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sid", nullable = false)
    private School sid;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tid", nullable = false)
    private Title tid;

    @NotNull
    @ColumnDefault("CURRENT_TIMESTAMP")
    @CreationTimestamp
    @Column(name = "created", nullable = false, updatable = false)
    private Instant created;

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

    public Title getTid() {
        return tid;
    }

    public void setTid(Title tid) {
        this.tid = tid;
    }

    public Instant getCreated() {
        return created;
    }

    public void setCreated(Instant created) {
        this.created = created;
    }

}