package tw.com.slsinfo.essayai.models.openai;

import com.fasterxml.jackson.annotation.JsonProperty;
import tw.com.slsinfo.commons.io.SerializeModel;

public class TokenDetailsModel extends SerializeModel {
    @JsonProperty("cached_tokens")
    private Integer cachedTokens;

    public TokenDetailsModel() {
    }

    public Integer getCachedTokens() {
        return cachedTokens;
    }

    public void setCachedTokens(Integer cachedTokens) {
        this.cachedTokens = cachedTokens;
    }
}
