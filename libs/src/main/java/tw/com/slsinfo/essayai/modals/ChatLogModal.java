package tw.com.slsinfo.essayai.modals;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.form.AjaxFormComponentUpdatingBehavior;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.markup.html.WebMarkupContainer;
import org.apache.wicket.markup.html.basic.Label;
import org.apache.wicket.markup.html.form.DropDownChoice;
import org.apache.wicket.markup.html.list.ListItem;
import org.apache.wicket.markup.html.list.ListView;
import org.apache.wicket.model.Model;
import org.apache.wicket.model.PropertyModel;
import tw.com.slsinfo.commons.io.DTUtils;
import tw.com.slsinfo.commons.wicket.modal.BaseModal;
import tw.com.slsinfo.essayai.databases.mongo.entities.ChatLogs;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stage;
import tw.com.slsinfo.essayai.models.ConfirmModel;
import tw.com.slsinfo.essayai.models.SelectOption;
import tw.com.slsinfo.essayai.services.ChatLogsService;
import tw.com.slsinfo.essayai.services.StageService;

import java.io.Serializable;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;


/**
 * 對話記錄Modal
 */
public class ChatLogModal extends BaseModal<ChatLogModal.ChatLogData> {
    private static final long serialVersionUID = 1L;
    private static final Logger logger = LogManager.getLogger(ChatLogModal.class);

    private Integer cgid;
    private String groupName;
    private String llmtype;
    private Integer stageid;
    private Integer selectedStageId; // 新增：選中的 stageid
    private WebMarkupContainer chatContainer;
    private ListView<ChatLogs> chatlogListView;
    private DropDownChoice<SelectOption> stageSelect; // 新增：階段下拉選單
    private SimpleDateFormat dateFormat = new SimpleDateFormat("MM/dd HH:mm");
    private Label groupNameLabel;
    private Label emptyMessage;

    public ChatLogModal(String id) {
        super(id);
        setInitialModalSize(ModalSize.Larger);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();

        groupNameLabel = new Label("groupName", Model.of(""));
        groupNameLabel.setOutputMarkupId(true);
        add(groupNameLabel);

        // 新增：階段選擇下拉選單
        stageSelect = new DropDownChoice<SelectOption>(
                "stageSelect",
                new PropertyModel<>(this, "selectedStageOption"),
                Model.ofList(new ArrayList<>())
        ) {
            @Override
            protected String getNullValidDisplayValue() {
                return "請選擇階段";
            }
        };
        stageSelect.setOutputMarkupId(true);
        stageSelect.add(new AjaxFormComponentUpdatingBehavior("change") {
            @Override
            protected void onUpdate(AjaxRequestTarget target) {
                if (selectedStageOption != null) {
                    selectedStageId = Integer.valueOf(selectedStageOption.getValue());
                    loadChatlogDataByStage();
                    target.add(chatContainer);

                    // 滾動到最下方
                    scrollToBottom(target);
                }
            }
        });
        add(stageSelect);

        chatContainer = new WebMarkupContainer("chatContainer");
        chatContainer.setOutputMarkupId(true);

        emptyMessage = new Label("emptyMessage", "目前沒有對話記錄") {
            @Override
            protected void onConfigure() {
                super.onConfigure();
                setVisible(chatlogListView.getList().isEmpty());
            }
        };
        emptyMessage.setOutputMarkupPlaceholderTag(true);

        chatlogListView = new ListView<ChatLogs>("chatlogList", Model.ofList(List.of())) {
            @Override
            protected void populateItem(ListItem<ChatLogs> item) {
                ChatLogs chatlog = item.getModelObject();

                EventType eventType = chatlog.getEventType();

                boolean isUser = eventType == EventType.USER_PROMPT
                        || eventType == EventType.USER_AUDIO_PROMPT
                        || eventType == EventType.USER_AUDIO_TRANSCRIPT
                        || eventType == EventType.USER_SUMMARY_PROMPT
                        || eventType == EventType.USER_CLICK_SUMMARY
                        || eventType == EventType.USER_CONTINUE_PROMPT
                        || eventType == EventType.POST;

                boolean isAssistant = eventType == EventType.SYSTEM_PROMPTS
                        || eventType == EventType.GOT_AI_RESPONSE
                        || eventType == EventType.CLIENT_GOT_AI_RESPONSE
                        || eventType == EventType.LLM_RESPONSE
                        || eventType == EventType.GOT_AI_TREE_RESPONSE
                        || eventType == EventType.SET_ARTICLE_JUDGE_PROMPT;

                String messageClass = isUser ? "message-user" :
                        isAssistant ? "message-assistant" : "message-system";
                item.add(new org.apache.wicket.AttributeModifier("class", messageClass));

                String senderName = isUser ? "學生" :
                        isAssistant ? "AI 助教" : "系統";
                Label sender = new Label("sender", senderName);
                Label eventTypeName = new Label("eventTypeName", eventType.getName());

                // 訊息內容
                String messageContent = chatlog.getMessage() != null ? chatlog.getMessage() : "";
                Label content = new Label("content", messageContent);

                if (StringUtils.isBlank(chatlog.getTimestamp())) {
                    chatlog.setTimestamp(DTUtils.getISODateTime());
                }
                Label timestamp = new Label("timestamp", DTUtils.parseISODateTime(chatlog.getTimestamp()));

                // UID 顯示（選擇性）
                String uidInfo = chatlog.getTruename() != null ? chatlog.getTruename() : "";
                Label uid = new Label("uid", uidInfo);
                uid.setVisible(isUser && uidInfo.length() > 0);

                item.add(sender, eventTypeName, content, timestamp, uid);
            }

            @Override
            protected void onConfigure() {
                super.onConfigure();
                setVisible(!getList().isEmpty());
            }
        };
        chatlogListView.setOutputMarkupPlaceholderTag(true);

        chatContainer.add(chatlogListView, emptyMessage);

        // 重新整理按鈕
        AjaxLink<Void> refreshButton = new AjaxLink<Void>("refreshButton") {
            private static final long serialVersionUID = 1L;

            @Override
            public void onClick(AjaxRequestTarget target) {
                loadStageOptions(); // 重新載入階段選項
                loadChatlogDataByStage();
                target.add(stageSelect, chatContainer);

                // 滾動到最下方
                target.appendJavaScript(
                        "setTimeout(function() {" +
                                "  var container = document.querySelector('.chat-log-container');" +
                                "  if (container) {" +
                                "    container.scrollTo({" +
                                "      top: container.scrollHeight," +
                                "      behavior: 'smooth'" +
                                "    });" +
                                "  }" +
                                "}, 100);"
                );
            }
        };

        // 關閉按鈕
        AjaxLink<Void> closeButton = new AjaxLink<Void>("closeButton") {
            private static final long serialVersionUID = 1L;

            @Override
            public void onClick(AjaxRequestTarget target) {
                close(target);
            }
        };

        add(chatContainer, refreshButton, closeButton);
    }

    @Override
    public void setModelObject(ChatLogData data) {
        if (data != null) {
            this.cgid = data.getCgid();
            this.groupName = data.getGroupName();
            this.llmtype = data.getLlmtype();

            groupNameLabel.setDefaultModelObject(groupName);
            loadStageOptions();
            loadChatlogData();
        }
    }

    /**
     * 設定資料並更新畫面後顯示 Modal
     */
    public void setResponseAndShow(Integer cgid, String groupName, String llmtype, int stageid, AjaxRequestTarget target) {
        this.cgid = cgid;
        this.groupName = groupName;
        this.llmtype = llmtype;
        this.stageid = stageid;
        groupNameLabel.setDefaultModelObject(groupName);

        // 重置選中的階段選項
        selectedStageOption = null;
        selectedStageId = null;

        loadStageOptions();
        loadChatlogData();

        // 關鍵：必須將更新後的容器加入 target
        target.add(chatContainer, groupNameLabel, stageSelect);

        // 顯示 Modal
        show(target);

        // 顯示後滾動到最下方
        target.appendJavaScript(
                "setTimeout(function() {" +
                        "  var container = document.querySelector('.chat-log-container');" +
                        "  if (container) {" +
                        "    container.scrollTop = container.scrollHeight;" +
                        "  }" +
                        "}, 200);"
        );

        logger.debug("顯示對話記錄 Modal: cgid={}, groupName={}, 記錄數={}",
                cgid, groupName, chatlogListView.getList().size());
    }

    public void setResponse(Integer cgid, String groupName) {
        this.cgid = cgid;
        this.groupName = groupName;
        groupNameLabel.setDefaultModelObject(groupName);
        loadStageOptions();
        loadChatlogDataByStage();
    }

    private void loadChatlogData() {
        if (cgid != null) {
            try {
//                List<ChatLogs> chatlogs = CDI.current().select(ChatLogsService.class)
//                        .get().getChatLogsbycgid(cgid);
                List<ChatLogs> chatlogs = CDI.current().select(ChatLogsService.class)
                        .get().getChatLogsByCgidAndStageId(cgid, stageid, true);
                chatlogListView.setList(chatlogs != null ? chatlogs : List.of());
                logger.debug("載入對話記錄成功: cgid={}, stageid:{}, 記錄數={}", cgid, stageid,
                        chatlogs != null ? chatlogs.size() : 0);
            } catch (Exception e) {
                logger.debug("載入對話記錄失敗: cgid={}, stageid:{}", cgid, stageid, e);
                chatlogListView.setList(List.of());
            }
        }
    }

    /**
     * 內部類別：封裝對話資料
     */
    public static class ChatLogData implements Serializable {
        private Integer cgid;
        private String groupName;
        private String llmtype;

        public ChatLogData(Integer cgid, String groupName) {
            this.cgid = cgid;
            this.groupName = groupName;
        }

        public Integer getCgid() {
            return cgid;
        }

        public void setCgid(Integer cgid) {
            this.cgid = cgid;
        }

        public String getGroupName() {
            return groupName;
        }

        public void setGroupName(String groupName) {
            this.groupName = groupName;
        }

        public String getLlmtype() {
            return llmtype;
        }

        public void setLlmtype(String llmtype) {
            this.llmtype = llmtype;
        }
    }

    /**
     * 新增：載入所有可用的階段選項
     */
    private void loadStageOptions() {
        if (cgid != null) {
            try {
                StageService service = CDI.current().select(StageService.class).get();

                // 取得該 cgid 的所有不重複 stageid
                List<Stage> stageIds = service.findAllStages(llmtype, "group");

                List<SelectOption> options = stageIds.stream()
                        .map(stageId -> new SelectOption(stageId.getId().toString(), "階段" + stageId.getId().toString() + ":" + stageId.getStagename()))
                        .collect(Collectors.toList());

                stageSelect.setChoices(options);
                // 根據傳入的 stageid 設定預設選項
                if (!options.isEmpty()) {
                    if (this.stageid != null) {
                        // 尋找符合的選項
                        selectedStageOption = options.stream()
                                .filter(opt -> opt.getValue().equals(this.stageid.toString()))
                                .findFirst()
                                .orElse(options.get(0));
                    } else {
                        selectedStageOption = options.get(0);
                    }
                    selectedStageId = Integer.valueOf(selectedStageOption.getValue());
                } else {
                    selectedStageOption = null;
                    selectedStageId = null;
                }

                logger.debug("載入階段選項成功: cgid={}, 階段數={}", cgid, options.size());
            } catch (Exception e) {
                logger.debug("載入階段選項失敗: cgid={}", cgid, e);
                stageSelect.setChoices(List.of());
                selectedStageOption = null;
                selectedStageId = null;
            }
        }
    }

    /**
     * 新增：根據選擇的 stageid 載入對話記錄
     */
    private void loadChatlogDataByStage() {
        if (cgid != null && selectedStageId != null) {
            try {
                ChatLogsService service = CDI.current().select(ChatLogsService.class).get();
                List<ChatLogs> chatlogs = service.getChatLogsByCgidAndStageId(cgid, selectedStageId, true);
                chatlogListView.setList(chatlogs != null ? chatlogs : List.of());

                logger.debug("載入對話記錄成功: cgid={}, stageid={}, 記錄數={}",
                        cgid, selectedStageId, chatlogs != null ? chatlogs.size() : 0);
            } catch (Exception e) {
                logger.debug("載入對話記錄失敗: cgid={}, stageid={}", cgid, selectedStageId, e);
                chatlogListView.setList(List.of());
            }
        }
    }

    /**
     * 滾動到容器底部
     */
    private void scrollToBottom(AjaxRequestTarget target) {
        target.appendJavaScript(
                "setTimeout(function() {" +
                        "  var container = document.querySelector('.chat-log-container');" +
                        "  if (container) {" +
                        "    container.scrollTo({" +
                        "      top: container.scrollHeight," +
                        "      behavior: 'smooth'" +
                        "    });" +
                        "  }" +
                        "}, 100);"
        );
    }

    // Getter/Setter for Wicket binding
    private SelectOption selectedStageOption;

    public SelectOption getSelectedStageOption() {
        return selectedStageOption;
    }

    public void setSelectedStageOption(SelectOption selectedStageOption) {
        this.selectedStageOption = selectedStageOption;
    }

}