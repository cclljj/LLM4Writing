package tw.com.slsinfo.essayai.databases.mongo.entities.log4j2;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.apache.commons.lang3.builder.ToStringBuilder;

import java.io.Serializable;


/**
 * log4j event Source class payload
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Source implements Serializable {

    private static final long serialVersionUID = 303559358741154643L;

    @JsonProperty("className")
    private String className;
    @JsonProperty("methodName")
    private String methodName;
    @JsonProperty("fileName")
    private String fileName;
    @JsonProperty("lineNumber")
    private Integer lineNumber;

    public Source() {
    }

    @JsonProperty("className")
    public String getClassName() {
        return className;
    }

    @JsonProperty("className")
    public void setClassName(String className) {
        this.className = className;
    }

    @JsonProperty("methodName")
    public String getMethodName() {
        return methodName;
    }

    @JsonProperty("methodName")
    public void setMethodName(String methodName) {
        this.methodName = methodName;
    }

    @JsonProperty("fileName")
    public String getFileName() {
        return fileName;
    }

    @JsonProperty("fileName")
    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    @JsonProperty("lineNumber")
    public Integer getLineNumber() {
        return lineNumber;
    }

    @JsonProperty("lineNumber")
    public void setLineNumber(Integer lineNumber) {
        this.lineNumber = lineNumber;
    }

    @Override
    public String toString() {
        return new ToStringBuilder(this)
                .append("className", className)
                .append("methodName", methodName)
                .append("fileName", fileName)
                .append("lineNumber", lineNumber)
                .toString();
    }

    @Override
    public boolean equals(Object obj) {
        return super.equals(obj);
    }
}