package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.*;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;

import java.io.Serializable;
import java.time.Instant;


@NamedQueries(
        {
                @NamedQuery(name = NamedQueryNames.GET_CURRENT_ACTIVITY_BY_CID_CGID,
                        query = "Select s from Stagelog s " +
                                "join fetch s.cid " +
                                "join fetch s.cgid " +
                                "join fetch s.stageid " +
                                "where s.cgid.id = :cgid " +
                                "and s.cid.id = :cid " +
                                "order by s.created desc")
        }
)
@Entity
@Table(name = "stagelog", schema = "aidb")
public class Stagelog implements Serializable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cid")
    private Classinfo cid;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stageid")
    private Stage stageid;

    @Size(max = 100)
    @Column(name = "responseid", length = 100)
    private String responseid;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "created")
    private Instant created;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ocid")
    private Openclass ocid;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cgid")
    private Classgroup cgid;

    @Size(max = 100)
    @Column(name = "messageid", length = 100)
    private String messageid;

    @Size(max = 100)
    @ColumnDefault("'1'")
    @Column(name = "attend", length = 100)
    private String attend;

    @Size(max = 100)
    @ColumnDefault("'0'")
    @Column(name = "isend", length = 100, insertable = false)
    private String isend;

    public String getIsend() {
        return isend;
    }

    public void setIsend(String isend) {
        this.isend = isend;
    }

    public String getAttend() {
        return attend;
    }

    public void setAttend(String attend) {
        this.attend = attend;
    }

    public String getMessageid() {
        return messageid;
    }

    public void setMessageid(String messageid) {
        this.messageid = messageid;
    }

    public Classgroup getCgid() {
        return cgid;
    }

    public void setCgid(Classgroup cgid) {
        this.cgid = cgid;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Classinfo getCid() {
        return cid;
    }

    public void setCid(Classinfo cid) {
        this.cid = cid;
    }

    public Stage getStageid() {
        return stageid;
    }

    public void setStageid(Stage stageid) {
        this.stageid = stageid;
    }

    public String getResponseid() {
        return responseid;
    }

    public void setResponseid(String responseid) {
        this.responseid = responseid;
    }

    public Instant getCreated() {
        return created;
    }

    public void setCreated(Instant created) {
        this.created = created;
    }

    public Openclass getOcid() {
        return ocid;
    }

    public void setOcid(Openclass ocid) {
        this.ocid = ocid;
    }

}