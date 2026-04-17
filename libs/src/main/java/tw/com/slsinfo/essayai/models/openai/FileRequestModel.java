package tw.com.slsinfo.essayai.models.openai;

import tw.com.slsinfo.commons.io.SerializeModel;

import java.io.File;

/**
 * 上傳檔案至OpenAI Request Payload
 */
public class FileRequestModel extends SerializeModel {
    private File file;
    private String purpose;

    public FileRequestModel() {
    }

    public FileRequestModel(File file, String purpose) {
        this.file = file;
        this.purpose = purpose;
    }

    public File getFile() {
        return file;
    }

    public void setFile(File file) {
        this.file = file;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }
}
