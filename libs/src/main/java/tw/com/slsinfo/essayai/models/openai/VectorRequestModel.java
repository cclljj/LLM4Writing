package tw.com.slsinfo.essayai.models.openai;

import tw.com.slsinfo.commons.io.SerializeModel;

/**
 * OpenAI向量資料庫 Request Payload
 */
public class VectorRequestModel extends SerializeModel {
    private String name;
    private ChunkingStrategyModel chunking_strategy;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public ChunkingStrategyModel getChunking_strategy() {
        return chunking_strategy;
    }

    public void setChunking_strategy(ChunkingStrategyModel chunking_strategy) {
        this.chunking_strategy = chunking_strategy;
    }
}
