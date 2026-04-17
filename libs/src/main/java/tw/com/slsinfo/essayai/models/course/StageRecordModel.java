package tw.com.slsinfo.essayai.models.course;

import java.io.Serializable;

/**
 * GoJS Tree Json Payload
 */
public class StageRecordModel implements Serializable {
    private Integer cid;
    private Integer ocid;
    private Integer cgid;
    private Integer stageid;
    private Integer seq;
    private String content;
    private String istree;

    public StageRecordModel() {
    }

    public Integer getCid() {
        return cid;
    }

    public void setCid(Integer cid) {
        this.cid = cid;
    }

    public Integer getOcid() {
        return ocid;
    }

    public void setOcid(Integer ocid) {
        this.ocid = ocid;
    }

    public Integer getCgid() {
        return cgid;
    }

    public void setCgid(Integer cgid) {
        this.cgid = cgid;
    }

    public Integer getStageid() {
        return stageid;
    }

    public void setStageid(Integer stageid) {
        this.stageid = stageid;
    }

    public Integer getSeq() {
        return seq;
    }

    public void setSeq(Integer seq) {
        this.seq = seq;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getIstree() {
        return istree;
    }

    public void setIstree(String istree) {
        this.istree = istree;
    }
}
