package tw.com.slsinfo.essayai.models.openai;

import com.fasterxml.jackson.annotation.JsonProperty;
import tw.com.slsinfo.commons.io.SerializeModel;

public class RankingOptionsModel extends SerializeModel {
    private String ranker;

    @JsonProperty("score_threshold")
    private Double scoreThreshold;

    public RankingOptionsModel() {
    }

    public String getRanker() {
        return ranker;
    }

    public void setRanker(String ranker) {
        this.ranker = ranker;
    }

    public Double getScoreThreshold() {
        return scoreThreshold;
    }

    public void setScoreThreshold(Double scoreThreshold) {
        this.scoreThreshold = scoreThreshold;
    }
}
