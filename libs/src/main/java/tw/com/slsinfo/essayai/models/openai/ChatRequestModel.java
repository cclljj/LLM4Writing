package tw.com.slsinfo.essayai.models.openai;

import com.fasterxml.jackson.annotation.JsonProperty;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.util.List;


/**
 * 與OpenAI對話Request Payload
 */
public class ChatRequestModel extends SerializeModel {
    private String model;
    private ReasoningModel reasoning;
    // 對話的ID
    @JsonProperty("previous_response_id")
    private String previousResponseId;
    private List<OpenAIInputModel> input;
    private List<ToolsModel> tools;

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public ReasoningModel getReasoning() {
        return reasoning;
    }

    public void setReasoning(ReasoningModel reasoning) {
        this.reasoning = reasoning;
    }

    public List<OpenAIInputModel> getInput() {
        return input;
    }

    public void setInput(List<OpenAIInputModel> input) {
        this.input = input;
    }

    public String getPreviousResponseId() {
        return previousResponseId;
    }

    public void setPreviousResponseId(String previousResponseId) {
        this.previousResponseId = previousResponseId;
    }

    public List<ToolsModel> getTools() {
        return tools;
    }

    public void setTools(List<ToolsModel> tools) {
        this.tools = tools;
    }
}
