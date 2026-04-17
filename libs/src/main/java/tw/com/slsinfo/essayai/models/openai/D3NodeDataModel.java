package tw.com.slsinfo.essayai.models.openai;

import tw.com.slsinfo.commons.io.SerializeModel;

public class D3NodeDataModel extends SerializeModel {
    public int id;
    public Integer parentId;
    public String title;
    public String content;

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public Integer getParentId() {
        return parentId;
    }

    public void setParentId(Integer parentId) {
        this.parentId = parentId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
