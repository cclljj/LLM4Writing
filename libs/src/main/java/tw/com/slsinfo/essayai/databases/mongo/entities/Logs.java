package tw.com.slsinfo.essayai.databases.mongo.entities;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import org.apache.commons.lang3.builder.ToStringBuilder;
import org.bson.types.ObjectId;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.AdditionalFields;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.LogModel;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.Source;

import java.io.Serializable;
import java.util.Date;
import java.util.List;


/**
 * 系統使用日誌
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Logs implements Serializable {

    @JsonProperty("_id")
    private ObjectId id;
    @JsonProperty("level")
    private String level;
    @JsonProperty("loggerName")
    private String loggerName;
    @JsonProperty("message")
    private String message;
    @JsonProperty("source")
    @Valid
    private Source source;
    @JsonProperty("marker")
    private Object marker;
    @JsonProperty("threadId")
    private Long threadId;
    @JsonProperty("threadName")
    private String threadName;
    @JsonProperty("threadPriority")
    private Integer threadPriority;
    @JsonProperty("millis")
    private Long millis;
    @JsonProperty("date")
    private Date date;
    @JsonProperty("thrown")
    private Object thrown;
    @JsonProperty("contextMap")
    @Valid
    private LogModel logModel;
    @JsonProperty("contextStack")
    @Valid
    private List<String> contextStack;
    @JsonProperty("additionalFields")
    @Valid
    private AdditionalFields additionalFields;

    @JsonProperty("_id")
    public ObjectId getId() {
        return id;
    }

    @JsonProperty("_id")
    public void setId(ObjectId id) {
        this.id = id;
    }

    @JsonProperty("level")
    public String getLevel() {
        return level;
    }

    @JsonProperty("level")
    public void setLevel(String level) {
        this.level = level;
    }

    @JsonProperty("loggerName")
    public String getLoggerName() {
        return loggerName;
    }

    @JsonProperty("loggerName")
    public void setLoggerName(String loggerName) {
        this.loggerName = loggerName;
    }

    @JsonProperty("message")
    public String getMessage() {
        return message;
    }

    @JsonProperty("message")
    public void setMessage(String message) {
        this.message = message;
    }

    @JsonProperty("source")
    public Source getSource() {
        return source;
    }

    @JsonProperty("source")
    public void setSource(Source source) {
        this.source = source;
    }

    @JsonProperty("marker")
    public Object getMarker() {
        return marker;
    }

    @JsonProperty("marker")
    public void setMarker(Object marker) {
        this.marker = marker;
    }

    @JsonProperty("threadId")
    public Long getThreadId() {
        return threadId;
    }

    @JsonProperty("threadId")
    public void setThreadId(Long threadId) {
        this.threadId = threadId;
    }

    @JsonProperty("threadName")
    public String getThreadName() {
        return threadName;
    }

    @JsonProperty("threadName")
    public void setThreadName(String threadName) {
        this.threadName = threadName;
    }

    @JsonProperty("threadPriority")
    public Integer getThreadPriority() {
        return threadPriority;
    }

    @JsonProperty("threadPriority")
    public void setThreadPriority(Integer threadPriority) {
        this.threadPriority = threadPriority;
    }

    @JsonProperty("millis")
    public Long getMillis() {
        return millis;
    }

    @JsonProperty("millis")
    public void setMillis(Long millis) {
        this.millis = millis;
    }

    @JsonProperty("date")
    public Date getDate() {
        return date;
    }

    @JsonProperty("date")
    public void setDate(Date date) {
        this.date = date;
    }

    @JsonProperty("thrown")
    public Object getThrown() {
        return thrown;
    }

    @JsonProperty("thrown")
    public void setThrown(Object thrown) {
        this.thrown = thrown;
    }

    @JsonProperty("contextMap")
    public LogModel getContextMap() {
        return logModel;
    }

    @JsonProperty("contextMap")
    public void setContextMap(LogModel logModel) {
        this.logModel = logModel;
    }

    @JsonProperty("contextStack")
    public List<String> getContextStack() {
        return contextStack;
    }

    @JsonProperty("contextStack")
    public void setContextStack(List<String> contextStack) {
        this.contextStack = contextStack;
    }

    @JsonProperty("additionalFields")
    public AdditionalFields getAdditionalFields() {
        return additionalFields;
    }

    @JsonProperty("additionalFields")
    public void setAdditionalFields(AdditionalFields additionalFields) {
        this.additionalFields = additionalFields;
    }

    @Override
    public String toString() {
        return new ToStringBuilder(this)
                .append("id", id)
                .append("level", level)
                .append("loggerName", loggerName)
                .append("message", message)
                .append("source", source)
                .append("marker", marker)
                .append("threadId", threadId)
                .append("threadName", threadName)
                .append("threadPriority", threadPriority)
                .append("millis", millis)
                .append("date", date)
                .append("thrown", thrown)
                .append("contextMap", logModel)
                .append("contextStack", contextStack)
                .append("additionalFields", additionalFields)
                .toString();
    }
}