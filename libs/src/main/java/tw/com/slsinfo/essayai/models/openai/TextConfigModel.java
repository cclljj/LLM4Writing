package tw.com.slsinfo.essayai.models.openai;

import tw.com.slsinfo.commons.io.SerializeModel;

public class TextConfigModel extends SerializeModel {
    private OpenAIFormatModel format;
    private String verbosity;

    public TextConfigModel() {
    }

    public OpenAIFormatModel getFormat() {
        return format;
    }

    public void setFormat(OpenAIFormatModel format) {
        this.format = format;
    }

    public String getVerbosity() {
        return verbosity;
    }

    public void setVerbosity(String verbosity) {
        this.verbosity = verbosity;
    }
}
