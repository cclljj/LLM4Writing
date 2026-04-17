package tw.com.slsinfo.essayai.models.openai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import tw.com.slsinfo.commons.io.SerializeModel;

public class UsageModel extends SerializeModel {
    @JsonProperty("input_tokens")
    private Integer inputTokens;

    @JsonProperty("input_tokens_details")
    private TokenDetailsModel inputTokensDetails;

    @JsonProperty("output_tokens")
    private Integer outputTokens;

    @JsonProperty("output_tokens_details")
    private OutputTokenDetailsModel outputTokensDetails;

    @JsonProperty("total_tokens")
    private Integer totalTokens;

    public UsageModel() {
    }

    public Integer getInputTokens() {
        return inputTokens;
    }

    public void setInputTokens(Integer inputTokens) {
        this.inputTokens = inputTokens;
    }

    public TokenDetailsModel getInputTokensDetails() {
        return inputTokensDetails;
    }

    public void setInputTokensDetails(TokenDetailsModel inputTokensDetails) {
        this.inputTokensDetails = inputTokensDetails;
    }

    public Integer getOutputTokens() {
        return outputTokens;
    }

    public void setOutputTokens(Integer outputTokens) {
        this.outputTokens = outputTokens;
    }

    public OutputTokenDetailsModel getOutputTokensDetails() {
        return outputTokensDetails;
    }

    public void setOutputTokensDetails(OutputTokenDetailsModel outputTokensDetails) {
        this.outputTokensDetails = outputTokensDetails;
    }

    public Integer getTotalTokens() {
        return totalTokens;
    }

    public void setTotalTokens(Integer totalTokens) {
        this.totalTokens = totalTokens;
    }
}
