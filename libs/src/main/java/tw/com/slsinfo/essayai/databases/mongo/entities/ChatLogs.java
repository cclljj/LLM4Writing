package tw.com.slsinfo.essayai.databases.mongo.entities;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.apache.commons.lang3.builder.ToStringBuilder;
import org.bson.types.ObjectId;
import tw.com.slsinfo.essayai.chatroom.ChatEventType;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;

import java.io.Serializable;

/**
 * AI對話記錄
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatLogs implements Serializable {
    @JsonProperty("_id")
    private ObjectId id;
    //學生classinfo id
    @JsonProperty("cid")
    private int cid;
    //學習活動階段id
    @JsonProperty("stageid")
    private int stageid;
    //class group id
    @JsonProperty("cgid")
    private int cgid;
    // open class id
    @JsonProperty("ocid")
    private int ocid;
    // openai messageid
    @JsonProperty("responseid")
    private String responseid;
    // user uid
    @JsonProperty("uid")
    private String uid;
    //users table id
    @JsonProperty("userid")
    private int userid;
    @JsonProperty("truename")
    private String truename;
    @JsonProperty("message")
    private String message;
    @JsonProperty("eventtype")
    private EventType eventType;
    @JsonProperty("chateventtype")
    private ChatEventType chatEventType;
    @JsonProperty("timestamp")
    private String timestamp;

    public ChatLogs() {
    }


    public String getTimestamp() {
        return timestamp;
    }

    public ChatLogs setTimestamp(String timestamp) {
        this.timestamp = timestamp;
        return this;
    }

    @JsonProperty("chateventtype")
    public ChatEventType getChatEventType() {
        return chatEventType;
    }

    @JsonProperty("chateventtype")
    public ChatLogs setChatEventType(ChatEventType chatEventType) {
        this.chatEventType = chatEventType;
        return this;
    }

    @JsonProperty("eventtype")
    public EventType getEventType() {
        return eventType;
    }

    @JsonProperty("eventtype")
    public ChatLogs setEventType(EventType eventType) {
        this.eventType = eventType;
        return this;
    }

    @JsonProperty("truename")
    public String getTruename() {
        return truename;
    }

    @JsonProperty("truename")
    public ChatLogs setTruename(String truename) {
        this.truename = truename;
        return this;
    }

    @JsonProperty("userid")
    public int getUserid() {
        return userid;
    }

    @JsonProperty("userid")
    public ChatLogs setUserid(int userid) {
        this.userid = userid;
        return this;
    }

    @JsonProperty("_id")
    public ObjectId getId() {
        return id;
    }

    @JsonProperty("_id")
    public void setId(ObjectId id) {
        this.id = id;
    }


    @JsonProperty("cgid")
    public int getCgid() {
        return cgid;
    }

    @JsonProperty("cgid")
    public ChatLogs setCgid(int cgid) {
        this.cgid = cgid;
        return this;
    }

    @JsonProperty("cid")
    public int getCid() {
        return cid;
    }

    @JsonProperty("cid")
    public ChatLogs setCid(int cid) {
        this.cid = cid;
        return this;
    }

    @JsonProperty("ocid")
    public int getOcid() {
        return ocid;
    }

    @JsonProperty("ocid")
    public ChatLogs setOcid(int ocid) {
        this.ocid = ocid;
        return this;
    }

    @JsonProperty("responseid")
    public String getResponseid() {
        return responseid;
    }

    @JsonProperty("responseid")
    public ChatLogs setResponseid(String responseid) {
        this.responseid = responseid;
        return this;
    }

    @JsonProperty("stageid")
    public int getStageid() {
        return stageid;
    }

    @JsonProperty("stageid")
    public ChatLogs setStageid(int stageid) {
        this.stageid = stageid;
        return this;
    }

    @JsonProperty("uid")
    public String getUid() {
        return uid;
    }

    @JsonProperty("uid")
    public ChatLogs setUid(String uid) {
        this.uid = uid;
        return this;
    }

    @JsonProperty("message")
    public String getMessage() {
        return message;
    }

    @JsonProperty("message")
    public ChatLogs setMessage(String message) {
        this.message = message;
        return this;
    }

    @Override
    public String toString() {
        return new ToStringBuilder(this)
                .append("id", id)
                .append("cid", cid)
                .append("stageid", stageid)
                .append("cgid", cgid)
                .append("ocid", ocid)
                .append("responseid", responseid)
                .append("uid", uid)
                .append("message", message)
                .append("eventtype", eventType)
                .toString();
    }
}
