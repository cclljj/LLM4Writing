package tw.com.slsinfo.essayai.models.openai;

import tw.com.slsinfo.commons.io.SerializeModel;

import java.io.Serial;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * open ai related message and vector id wrapper
 */
public class ChatPageModel extends SerializeModel {
    @Serial
    private static final long serialVersionUID = 1L;

    private List<String> initPrompts;
    //舊MSGID
    private String previousId;
    //新MSGID
    private String messageId;
    //因應目前一個vector db包含許多檔案，所以vector id只有一個，但可以依據不同檔名為資料來源
    private String vectorId;
    private List<String> sourcefilename;
    //table: stagelog : stageid
    private int active;
    //小組聊天時需要同組的ID才能限制
    private int groupid;
    //作文或是討論主題
    private String title;
    private int essayid;
    private int genreid;
    //小組成員名單
    private Set<String> memberSet;

    //stactivitymodel 傳入的classgroupmember相關參數
    private Integer id;
    private Integer ocid;
    private String groupname;
    private Integer cgid;
    private Integer membercid;
    private String truename;
    private int userid;
    private String account;
    // 新增直接儲存需要顯示的欄位，避免關聯物件
    //目前個人與對話次數
    private int pturn = 0;

    public ChatPageModel() {
        initPrompts = new ArrayList<>();
    }

    public int getPturn() {
        return pturn;
    }

    public ChatPageModel setPturn(int pturn) {
        this.pturn = pturn;
        return this;
    }

    public String getAccount() {
        return account;
    }

    public ChatPageModel setAccount(String account) {
        this.account = account;
        return this;
    }

    public String getTruename() {
        return truename;
    }

    public ChatPageModel setTruename(String truename) {
        this.truename = truename;
        return this;
    }

    public int getUserid() {
        return userid;
    }

    public ChatPageModel setUserid(int userid) {
        this.userid = userid;
        return this;
    }

    public Set<String> getMemberSet() {
        return memberSet;
    }

    public ChatPageModel setMemberSet(Set<String> memberSet) {
        this.memberSet = memberSet;
        return this;
    }

    public String getMessageId() {
        return messageId;
    }

    public ChatPageModel setMessageId(String messageId) {
        this.messageId = messageId;
        return this;
    }

    public int getGroupid() {
        return groupid;
    }

    public ChatPageModel setGroupid(int groupid) {
        this.groupid = groupid;
        return this;
    }

    public int getActive() {
        return active;
    }

    public ChatPageModel setActive(int active) {
        this.active = active;
        return this;
    }

    public List<String> getInitPrompts() {
        return initPrompts;
    }

    public ChatPageModel addInitPrompt(String initPrompt) {
        initPrompts.add(initPrompt);
        return this;
    }

    public ChatPageModel setInitPrompts(List<String> initPrompt) {
        initPrompts.addAll(initPrompt);
        return this;
    }

    public String getPreviousId() {
        return previousId;
    }

    public ChatPageModel setPreviousId(String previousId) {
        this.previousId = previousId;
        return this;
    }

    public List<String> getSourcefilename() {
        return sourcefilename;
    }

    public ChatPageModel setSourcefilename(List<String> sourcefilename) {
        this.sourcefilename = sourcefilename;
        return this;
    }

    public String getVectorId() {
        return vectorId;
    }

    public ChatPageModel setVectorId(String vectorId) {
        this.vectorId = vectorId;
        return this;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getEssayid() {
        return essayid;
    }

    public void setEssayid(int essayid) {
        this.essayid = essayid;
    }

    public int getGenreid() {
        return genreid;
    }

    public void setGenreid(int genreid) {
        this.genreid = genreid;
    }

    public Integer getMembercid() {
        return membercid;
    }

    public void setMembercid(Integer membercid) {
        this.membercid = membercid;
    }

    public Integer getCgid() {
        return cgid;
    }

    public void setCgid(Integer cgid) {
        this.cgid = cgid;
    }

    public String getGroupname() {
        return groupname;
    }

    public void setGroupname(String groupname) {
        this.groupname = groupname;
    }

    public Integer getOcid() {
        return ocid;
    }

    public void setOcid(Integer ocid) {
        this.ocid = ocid;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }
}
