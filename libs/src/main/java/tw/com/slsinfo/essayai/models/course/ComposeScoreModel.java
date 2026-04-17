package tw.com.slsinfo.essayai.models.course;

import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.Composescore;

public class ComposeScoreModel extends SerializeModel {

    private Integer id;        // 改為 Integer
    private Integer ocid;      // 改為 Integer
    private Integer cid;       // 改為 Integer
    private String compose;
    private String aiscore;   // 改為 Integer,允許 null
    private String aicomment;
    private String score;     // 改為 Integer,允許 null
    private String comment;

    public ComposeScoreModel() {
    }

    public ComposeScoreModel(Integer id, Integer ocid, Integer cid, String compose,
                             String aiscore, String aicomment, String score, String comment) {
        this.id = id;
        this.ocid = ocid;
        this.cid = cid;
        this.compose = compose;
        this.aiscore = aiscore;
        this.aicomment = aicomment;
        this.score = score;
        this.comment = comment;
    }

    public static ComposeScoreModel createNew(Composescore s) {
        return new ComposeScoreModel(
                s.getId(),
                s.getOcid() != null ? s.getOcid().getId() : null,
                s.getCid() != null ? s.getCid().getId() : null,
                s.getCompose(),
                s.getAiscore(),   // 資料庫欄位本來就是 Integer,可為 null
                s.getAicomment(),
                s.getScore(),     // 資料庫欄位本來就是 Integer,可為 null
                s.getComment()
        );
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getOcid() {
        return ocid;
    }

    public void setOcid(Integer ocid) {
        this.ocid = ocid;
    }

    public Integer getCid() {
        return cid;
    }

    public void setCid(Integer cid) {
        this.cid = cid;
    }

    public String getCompose() {
        return compose;
    }

    public void setCompose(String compose) {
        this.compose = compose;
    }

    public String getAiscore() {
        return aiscore;
    }

    public void setAiscore(String aiscore) {
        this.aiscore = aiscore;
    }

    public String getAicomment() {
        return aicomment;
    }

    public void setAicomment(String aicomment) {
        this.aicomment = aicomment;
    }

    public String getScore() {
        return score;
    }

    public void setScore(String score) {
        this.score = score;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }
}