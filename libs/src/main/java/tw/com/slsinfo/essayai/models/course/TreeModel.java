package tw.com.slsinfo.essayai.models.course;

import java.io.Serializable;

/**
 * GoJS Tree Json Payload
 */
public class TreeModel implements Serializable {

    private String uid;
    private String type;
    private String json;
    private String visible;
    private Integer cgid;
    private ClassinfoViewModel account;

    public TreeModel() {
        this("1"); // 呼叫另一個建構子，預設 visible = "1"
    }

    public TreeModel(String visible) {
        this.visible = visible;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getJson() {
        return json;
    }

    public void setJson(String json) {
        this.json = json;
    }

    public String getVisible() {
        return visible;
    }

    public void setVisible(String visible) {
        this.visible = visible;
    }

    public Integer getCgid() {
        return cgid;
    }

    public void setCgid(Integer cgid) {
        this.cgid = cgid;
    }

    public ClassinfoViewModel getAccount() { return account; }
    public void setAccount(ClassinfoViewModel account) { this.account = account; }

}
