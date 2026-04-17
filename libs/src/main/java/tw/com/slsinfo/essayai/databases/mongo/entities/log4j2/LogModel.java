package tw.com.slsinfo.essayai.databases.mongo.entities.log4j2;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import tw.com.slsinfo.commons.io.SerializeModel;

import java.util.Objects;

/**
 * 自定義內容日誌內容
 */

@JsonInclude(JsonInclude.Include.NON_NULL)
public class LogModel extends SerializeModel {

    private static final long serialVersionUID = 3006686738546188213L;

    @JsonProperty("account")
    private String account;
    @JsonProperty("event")
    private EventType event;
    @JsonProperty("ip")
    private String ip;
    @JsonProperty("service")
    private ServiceType service;
    @JsonIgnore
    @JsonProperty("schoolid")
    private String schoolid;
    @JsonIgnore
    @JsonProperty("target")
    private String target;

    @JsonProperty("account")
    public String getAccount() {
        return account;
    }

    @JsonProperty("account")
    public void setAccount(String account) {
        this.account = account;
    }

    @JsonProperty("event")
    public EventType getEvent() {
        return event;
    }

    @JsonProperty("event")
    public void setEvent(EventType event) {
        this.event = event;
    }

    @JsonProperty("ip")
    public String getIp() {
        return ip;
    }

    @JsonProperty("ip")
    public void setIp(String ip) {
        this.ip = ip;
    }

    @JsonProperty("service")
    public ServiceType getService() {
        return service;
    }

    @JsonProperty("service")
    public void setService(ServiceType service) {
        this.service = service;
    }

    @JsonProperty("schoolid")
    public String getSchoolid() {
        return schoolid;
    }

    @JsonProperty("schoolid")
    public void setSchoolid(String schoolid) {
        this.schoolid = schoolid;
    }

    @JsonProperty("target")
    public String getTarget() {
        return target;
    }

    @JsonProperty("target")
    public void setTarget(String target) {
        this.target = target;
    }


    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        LogModel that = (LogModel) o;
        return Objects.equals(account, that.account) && event == that.event && Objects.equals(ip, that.ip) && Objects.equals(service, that.service) && Objects.equals(target, that.target);
    }

    @Override
    public int hashCode() {
        return Objects.hash(account, event, ip, service, target);
    }

}
