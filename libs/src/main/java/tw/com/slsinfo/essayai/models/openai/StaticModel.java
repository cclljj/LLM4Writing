package tw.com.slsinfo.essayai.models.openai;

import com.fasterxml.jackson.annotation.JsonProperty;
import tw.com.slsinfo.commons.io.SerializeModel;

public class StaticModel extends SerializeModel {
    @JsonProperty("max_chunk_size_tokens")
    private Integer maxChunkSizeTokens;

    @JsonProperty("chunk_overlap_tokens")
    private Integer chunkOverlapTokens;

    public StaticModel() {
    }

    public StaticModel(Integer maxChunkSizeTokens, Integer chunkOverlapTokens) {
        this.maxChunkSizeTokens = maxChunkSizeTokens;
        this.chunkOverlapTokens = chunkOverlapTokens;
    }

    public Integer getMaxChunkSizeTokens() {
        return maxChunkSizeTokens;
    }

    public void setMaxChunkSizeTokens(Integer maxChunkSizeTokens) {
        this.maxChunkSizeTokens = maxChunkSizeTokens;
    }

    public Integer getChunkOverlapTokens() {
        return chunkOverlapTokens;
    }

    public void setChunkOverlapTokens(Integer chunkOverlapTokens) {
        this.chunkOverlapTokens = chunkOverlapTokens;
    }
}
