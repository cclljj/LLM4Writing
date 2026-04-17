package tw.com.slsinfo.essayai.databases.mysql.entities;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.ColumnDefault;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.time.Instant;

@Entity
@Table(name = "JGROUPSPING", schema = "aidb")
public class Jgroupsping  extends SerializeModel {
    @EmbeddedId
    private JgroupspingId id;

    @ColumnDefault("CURRENT_TIMESTAMP")
    @Column(name = "updated")
    private Instant updated;

    @Size(max = 5000)
    @Column(name = "ping_data", length = 5000)
    private String pingData;

    public JgroupspingId getId() {
        return id;
    }

    public void setId(JgroupspingId id) {
        this.id = id;
    }

    public Instant getUpdated() {
        return updated;
    }

    public void setUpdated(Instant updated) {
        this.updated = updated;
    }

    public String getPingData() {
        return pingData;
    }

    public void setPingData(String pingData) {
        this.pingData = pingData;
    }

}