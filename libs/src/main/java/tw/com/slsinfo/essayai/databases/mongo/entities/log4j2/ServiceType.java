package tw.com.slsinfo.essayai.databases.mongo.entities.log4j2;


/**
 * Web類型
 */
public enum ServiceType {

    OPENAI("chatGPT"),
    LLM4Writing("作文輔助平臺"),
    LLM4Class("輔導活動平臺");

    private final String type;

    ServiceType(String type) {
        this.type = type;
    }

    public String getType() {
        return type;
    }
}
