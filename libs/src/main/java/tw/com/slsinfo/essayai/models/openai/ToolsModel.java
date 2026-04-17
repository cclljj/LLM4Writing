package tw.com.slsinfo.essayai.models.openai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.util.List;

public class ToolsModel extends SerializeModel {
    private String type;

    // file_search fields
    private Object filters;

    @JsonProperty("max_num_results")
    public Integer maxNumResults;

    @JsonProperty("ranking_options")
    private RankingOptionsModel rankingOptions;

    @JsonProperty("vector_store_ids")
    private List<String> vectorStoreIds;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Object getFilters() {
        return filters;
    }

    public void setFilters(Object filters) {
        this.filters = filters;
    }

    public Integer getMaxNumResults() {
        return maxNumResults;
    }

    public void setMaxNumResults(Integer maxNumResults) {
        this.maxNumResults = maxNumResults;
    }

    public RankingOptionsModel getRankingOptions() {
        return rankingOptions;
    }

    public void setRankingOptions(RankingOptionsModel rankingOptions) {
        this.rankingOptions = rankingOptions;
    }

    public List<String> getVectorStoreIds() {
        return vectorStoreIds;
    }

    public void setVectorStoreIds(List<String> vectorStoreIds) {
        this.vectorStoreIds = vectorStoreIds;
    }
}
