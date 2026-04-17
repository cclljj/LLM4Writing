package tw.com.slsinfo.essayai.models.openai;

import com.fasterxml.jackson.annotation.JsonProperty;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.util.Map;

/**
 * OpenAI向量資料庫 Response Payload
 */
public class VectorResponseModel extends SerializeModel {
    /**
     * e.g. "vs_689d4b..."
     */
    public String id;

    /**
     * e.g. "vector_store"
     */
    public String object;

    /**
     * Unix epoch seconds
     */
    @JsonProperty("created_at")
    public Long createdAt;

    public String name;

    /**
     * 可為 null
     */
    public String description;

    /**
     * 以 bytes 為單位的使用量
     */
    @JsonProperty("usage_bytes")
    public Long usageBytes;

    /**
     * 各類檔案統計
     */
    @JsonProperty("file_counts")
    public FileCountsModel fileCounts;

    /**
     * e.g. "completed", "in_progress", ...
     */
    public String status;

    /**
     * 自動到期策略；常見格式：
     * { "anchor": "last_active_at", "days": 30 }
     * 也可能為 null
     */
    @JsonProperty("expires_after")
    public ExpiresAfterModel expiresAfter;

    /**
     * 到期時間（秒）；可能為 null
     */
    @JsonProperty("expires_at")
    public Long expiresAt;

    /**
     * 最近活躍時間（秒）
     */
    @JsonProperty("last_active_at")
    public Long lastActiveAt;

    /**
     * 任意自定義鍵值
     */
    public Map<String, Object> metadata;

    public VectorResponseModel() {
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Long getUsageBytes() {
        return usageBytes;
    }

    public void setUsageBytes(Long usageBytes) {
        this.usageBytes = usageBytes;
    }

    public FileCountsModel getFileCounts() {
        return fileCounts;
    }

    public void setFileCounts(FileCountsModel fileCounts) {
        this.fileCounts = fileCounts;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public ExpiresAfterModel getExpiresAfter() {
        return expiresAfter;
    }

    public void setExpiresAfter(ExpiresAfterModel expiresAfter) {
        this.expiresAfter = expiresAfter;
    }

    public Long getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Long expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Long getLastActiveAt() {
        return lastActiveAt;
    }

    public void setLastActiveAt(Long lastActiveAt) {
        this.lastActiveAt = lastActiveAt;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public void setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
    }
}
