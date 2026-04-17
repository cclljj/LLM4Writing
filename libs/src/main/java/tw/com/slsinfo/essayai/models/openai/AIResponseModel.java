package tw.com.slsinfo.essayai.models.openai;

import tw.com.slsinfo.commons.io.SerializeModel;

/**
 * GPT response simple payload
 */
public class AIResponseModel extends SerializeModel {
    //新MSGID
    private final String messageid;
    //前次MSGID
    private final String responseid;
    //response text
    private String content;

    /**
     *
     * @param content    訊息內容
     * @param messageid  新MSGID
     * @param responseid 前次MSGID
     */
    public AIResponseModel(String content, String messageid, String responseid) {
        this.content = content;
        this.messageid = messageid;
        this.responseid = responseid;
    }

    public String getResponseid() {
        return responseid;
    }


    public String getMessageid() {
        return messageid;
    }


    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
