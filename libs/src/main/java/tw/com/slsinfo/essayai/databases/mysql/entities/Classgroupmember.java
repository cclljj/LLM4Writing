package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;

import java.io.Serializable;
import java.time.Instant;


@NamedQueries(
        {
                @NamedQuery(name = NamedQueryNames.GET_STU_GROUP_BY_UID,
                        query = "Select g from Classgroupmember g " +
                                "join fetch g.cgid " +
                                "join fetch g.memberCid " +
                                "where g.memberCid.uid =: uid")
        }
)
@Entity
@Table(name = "classgroupmember", schema = "aidb")
public class Classgroupmember implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cgid", nullable = false)
    private Classgroup cgid;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_cid", nullable = false)
    private Classinfo memberCid;

    @Column(name = "created", insertable = false, updatable = false)
    @ColumnDefault("CURRENT_TIMESTAMP")
    private Instant created;

    @Size(max = 1)
    @Column(name = "is_captain", length = 1)
    private String isCaptain;

    public String getIsCaptain() {
        return isCaptain;
    }

    public void setIsCaptain(String isCaptain) {
        this.isCaptain = isCaptain;
    }

    public Classgroupmember(Classgroup cgid, Classinfo memberCid) {
        this.cgid = cgid;
        this.memberCid = memberCid;
    }

    public Classgroupmember() {

    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Classinfo getMemberCid() {
        return memberCid;
    }

    public void setMemberCid(Classinfo memberCid) {
        this.memberCid = memberCid;
    }

    public Instant getCreated() {
        return created;
    }

    public void setCreated(Instant created) {
        this.created = created;
    }

    public Classgroup getCgid() {
        return cgid;
    }

    public void setCgid(Classgroup cgid) {
        this.cgid = cgid;
    }
}