package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.ColumnDefault;
import org.hibernate.annotations.CreationTimestamp;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;

import java.io.Serializable;
import java.time.Instant;


@NamedQueries(
        {
                @NamedQuery(name = NamedQueryNames.GETROLEUSER,
                        query = "Select r from Roleuser r " +
                                "join fetch r.rid " +
                                "join fetch r.uid " +
                                "join fetch r.sid " +
                                "where r.uid.uid = :uid " +
                                "and r.sid.sid = :schoolid "),
                @NamedQuery(name = NamedQueryNames.GETANYROLEUSER,
                        query = "Select r from Roleuser r " +
                                "join fetch r.rid " +
                                "join fetch r.uid " +
                                "join fetch r.sid " +
                                "where r.uid.uid = :uid"),
                @NamedQuery(name = NamedQueryNames.FIND_ROLEUSER_BY_SID_RID,
                        query = "Select r from Roleuser r " +
                                "join fetch r.rid " +
                                "join fetch r.uid " +
                                "join fetch r.sid " +
                                "where r.rid = :rid " +
                                "and r.sid.sid = :schoolid"
                )

        }
)
@Entity
@Table(name = "roleusers", schema = "aidb")
public class Roleuser implements Serializable {
    @Id
    @Column(name = "id", nullable = false)
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "rid", nullable = false)
    private Role rid;

    @NotNull
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "uid", nullable = false)
    private User uid;

    @NotNull
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "sid", nullable = false)
    private School sid;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @CreationTimestamp
    @Column(name = "created", nullable = false, updatable = false)
    private Instant created;

    public Instant getCreated() {
        return created;
    }

    public Roleuser setCreated(Instant created) {
        this.created = created;
        return this;
    }

    public Integer getId() {
        return id;
    }

    public Roleuser setId(Integer id) {
        this.id = id;
        return this;
    }

    public Role getRid() {
        return rid;
    }

    public Roleuser setRid(Role rid) {
        this.rid = rid;
        return this;
    }

    public School getSid() {
        return sid;
    }

    public Roleuser setSid(School sid) {
        this.sid = sid;
        return this;
    }

    public User getUid() {
        return uid;
    }

    public Roleuser setUid(User uid) {
        this.uid = uid;
        return this;
    }
}