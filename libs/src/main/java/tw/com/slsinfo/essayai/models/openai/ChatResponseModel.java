package tw.com.slsinfo.essayai.models.openai;

import com.fasterxml.jackson.annotation.JsonProperty;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.util.List;
import java.util.Map;


/**
 * 與OpenAI對話Response Payload
 */
public class ChatResponseModel extends SerializeModel {
    public String id;
    public String object;

    @JsonProperty("created_at")
    public Long createdAt;

    public String status;

    public Boolean background;
    public Object error;

    @JsonProperty("incomplete_details")
    public Object incompleteDetails;

    public Object instructions;

    @JsonProperty("max_output_tokens")
    public Integer maxOutputTokens;

    @JsonProperty("max_tool_calls")
    public Integer maxToolCalls;

    public String model;

    /**
     * 多型陣列：reasoning / file_search_call / message
     */
    public List<OutputItemModel> output;

    @JsonProperty("parallel_tool_calls")
    public Boolean parallelToolCalls;

    @JsonProperty("previous_response_id")
    public String previousResponseId;

    @JsonProperty("prompt_cache_key")
    public String promptCacheKey;

    public ReasoningModel reasoning;

    @JsonProperty("safety_identifier")
    public String safetyIdentifier;

    @JsonProperty("service_tier")
    public String serviceTier;

    public Boolean store;
    public Double temperature;

    /**
     * 文字輸出格式設定
     */
    public TextConfigModel text;

    @JsonProperty("tool_choice")
    public String toolChoice;

    /**
     * 工具列表（本檔案中出現 file_search）
     */
    public List<ToolsModel> tools;

    @JsonProperty("top_logprobs")
    public Integer topLogprobs;

    @JsonProperty("top_p")
    public Double topP;

    public String truncation;
    public UsageModel usage;
    public Object user;
    public Map<String, Object> metadata;

    public ChatResponseModel() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getObject() {
        return object;
    }

    public void setObject(String object) {
        this.object = object;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Boolean getBackground() {
        return background;
    }

    public void setBackground(Boolean background) {
        this.background = background;
    }

    public Object getError() {
        return error;
    }

    public void setError(Object error) {
        this.error = error;
    }

    public Object getIncompleteDetails() {
        return incompleteDetails;
    }

    public void setIncompleteDetails(Object incompleteDetails) {
        this.incompleteDetails = incompleteDetails;
    }

    public Object getInstructions() {
        return instructions;
    }

    public void setInstructions(Object instructions) {
        this.instructions = instructions;
    }

    public Integer getMaxOutputTokens() {
        return maxOutputTokens;
    }

    public void setMaxOutputTokens(Integer maxOutputTokens) {
        this.maxOutputTokens = maxOutputTokens;
    }

    public Integer getMaxToolCalls() {
        return maxToolCalls;
    }

    public void setMaxToolCalls(Integer maxToolCalls) {
        this.maxToolCalls = maxToolCalls;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public List<OutputItemModel> getOutput() {
        return output;
    }

    public void setOutput(List<OutputItemModel> output) {
        this.output = output;
    }

    public Boolean getParallelToolCalls() {
        return parallelToolCalls;
    }

    public void setParallelToolCalls(Boolean parallelToolCalls) {
        this.parallelToolCalls = parallelToolCalls;
    }

    public String getPreviousResponseId() {
        return previousResponseId;
    }

    public void setPreviousResponseId(String previousResponseId) {
        this.previousResponseId = previousResponseId;
    }

    public String getPromptCacheKey() {
        return promptCacheKey;
    }

    public void setPromptCacheKey(String promptCacheKey) {
        this.promptCacheKey = promptCacheKey;
    }

    public ReasoningModel getReasoning() {
        return reasoning;
    }

    public void setReasoning(ReasoningModel reasoning) {
        this.reasoning = reasoning;
    }

    public String getSafetyIdentifier() {
        return safetyIdentifier;
    }

    public void setSafetyIdentifier(String safetyIdentifier) {
        this.safetyIdentifier = safetyIdentifier;
    }

    public String getServiceTier() {
        return serviceTier;
    }

    public void setServiceTier(String serviceTier) {
        this.serviceTier = serviceTier;
    }

    public Boolean getStore() {
        return store;
    }

    public void setStore(Boolean store) {
        this.store = store;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public TextConfigModel getText() {
        return text;
    }

    public void setText(TextConfigModel text) {
        this.text = text;
    }

    public String getToolChoice() {
        return toolChoice;
    }

    public void setToolChoice(String toolChoice) {
        this.toolChoice = toolChoice;
    }

    public List<ToolsModel> getTools() {
        return tools;
    }

    public void setTools(List<ToolsModel> tools) {
        this.tools = tools;
    }

    public Integer getTopLogprobs() {
        return topLogprobs;
    }

    public void setTopLogprobs(Integer topLogprobs) {
        this.topLogprobs = topLogprobs;
    }

    public Double getTopP() {
        return topP;
    }

    public void setTopP(Double topP) {
        this.topP = topP;
    }

    public String getTruncation() {
        return truncation;
    }

    public void setTruncation(String truncation) {
        this.truncation = truncation;
    }

    public UsageModel getUsage() {
        return usage;
    }

    public void setUsage(UsageModel usage) {
        this.usage = usage;
    }

    public Object getUser() {
        return user;
    }

    public void setUser(Object user) {
        this.user = user;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }
}
