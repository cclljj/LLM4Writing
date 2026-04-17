package tw.com.slsinfo.essayai.models.openai;

import org.apache.commons.fileupload.FileUpload;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.util.List;

/**
 * OpenAI chat input model payload
 */
public class OpenAIInputModel extends SerializeModel {
    private String role;
    private String content;
    private List<FileUpload> upload;

    public OpenAIInputModel() {
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public List<FileUpload> getUpload() {
        return upload;
    }

    public void setUpload(List<FileUpload> upload) {
        this.upload = upload;
    }
}
