package tw.com.slsinfo.essayai.models.openai;

import tw.com.slsinfo.commons.io.SerializeModel;

/**
 * OpenAI Response Format
 */
public class OpenAIFormatModel extends SerializeModel {
    private String type;

    public OpenAIFormatModel() {
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}
