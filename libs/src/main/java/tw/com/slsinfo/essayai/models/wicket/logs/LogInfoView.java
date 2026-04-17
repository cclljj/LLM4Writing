package tw.com.slsinfo.essayai.models.wicket.logs;

import tw.com.slsinfo.commons.io.DTUtils;
import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;
import tw.com.slsinfo.essayai.databases.mongo.entities.Logs;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.ServiceType;

import java.util.Date;

public class LogInfoView extends SerializeModel {

    private String uid;

    private ServiceType serviceType;

    private EventType eventType;

    private String schoolid;

    private String ip;

    private String date;

    private String message;


    public LogInfoView() {
    }


    public LogInfoView(String uid, ServiceType serviceType, EventType eventType, Date date, String message, String ip, String schoolid) {
        this.uid = uid;
        this.serviceType = serviceType;
        this.eventType = eventType;
        this.date = DTUtils.parseISODateTime(date.toInstant().toString());
        this.message = message;
        this.ip = ip;
        this.schoolid = schoolid;

    }

    public static LogInfoView createNew(final Logs log) {
        return new LogInfoView(log.getContextMap().getAccount(), log.getContextMap().getService(), log.getContextMap().getEvent(), log.getDate(), log.getMessage(), log.getContextMap().getIp(), log.getContextMap().getSchoolid());
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public ServiceType getServiceType() {
        return serviceType;
    }

    public void setServiceType(ServiceType serviceType) {
        this.serviceType = serviceType;
    }

    public EventType getEventType() {
        return eventType;
    }

    public void setEventType(EventType eventType) {
        this.eventType = eventType;
    }

    public String getDate() {
        return date;
    }

    public LogInfoView setDate(String date) {
        this.date = date;
        return this;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getSchoolid() {
        return schoolid;
    }

    public void setSchoolid(String schoolid) {
        this.schoolid = schoolid;
    }

    public String getIp() {
        return ip;
    }

    public LogInfoView setIp(String ip) {
        this.ip = ip;
        return this;
    }
}
