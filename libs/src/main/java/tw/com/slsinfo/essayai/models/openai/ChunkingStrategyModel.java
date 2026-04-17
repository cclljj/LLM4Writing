package tw.com.slsinfo.essayai.models.openai;

import com.fasterxml.jackson.annotation.JsonProperty;
import tw.com.slsinfo.commons.io.SerializeModel;

public class ChunkingStrategyModel extends SerializeModel {
    private String type;

    @JsonProperty("static")
    private StaticModel staticModel;

    public ChunkingStrategyModel() {
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public StaticModel getStaticModel() {
        return staticModel;
    }

    public void setStaticModel(StaticModel staticModel) {
        this.staticModel = staticModel;
    }
}
