package tw.com.slsinfo.panel.chat;

import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.ajax.markup.html.form.AjaxSubmitLink;
import org.apache.wicket.markup.head.IHeaderResponse;
import org.apache.wicket.markup.head.JavaScriptHeaderItem;
import org.apache.wicket.markup.html.form.Form;
import org.apache.wicket.markup.html.form.StatelessForm;
import org.apache.wicket.markup.html.form.TextArea;
import org.apache.wicket.markup.html.form.upload.FileUpload;
import org.apache.wicket.markup.html.form.upload.FileUploadField;
import org.apache.wicket.markup.html.panel.FeedbackPanel;
import org.apache.wicket.model.CompoundPropertyModel;
import org.apache.wicket.model.IModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.basic.BasePanel;
import tw.com.slsinfo.commons.wicket.components.blockui.AjaxLinkBlockUI;
import tw.com.slsinfo.commons.wicket.components.blockui.AjaxSubmitLinkBlockUI;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.essayai.models.openai.OpenAIInputModel;
import tw.com.slsinfo.essayai.utils.AIConstants;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;

/**
 * 送出AI對話表單，包含打字與錄音
 */
public abstract class AudioChatFormPanel extends BasePanel {
    private static final long serialVersionUID = 1L;
    private static final Logger logger = LoggerFactory.getLogger(AudioChatFormPanel.class);
    private TextArea<String> content;
    //此表單有一個文字輸入欄位
    private OpenAIInputModel openAIInputModel;
    private IModel<ChatPageModel> chatPageModel;
    private StatelessForm<String> chatForm;
    //一個語音輸入參數
    private FileUploadField uploadField;
    //錄音鈕
    private AjaxLink<Void> btnRecord;
    //錄音檔上傳至OpenAI
    private AjaxSubmitLink btnAudioUpload;

    protected AudioChatFormPanel(String id, IModel<ChatPageModel> chatPageModel) {
        super(id);
        this.chatPageModel = chatPageModel;
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        openAIInputModel = new OpenAIInputModel();
        chatForm = new StatelessForm<>("chatForm");
        chatForm.setOutputMarkupId(true);
        chatForm.setDefaultModel(new CompoundPropertyModel<>(openAIInputModel));
        content = new TextArea<>("content");
        content.setOutputMarkupId(true);

        AjaxSubmitLink btnPost = new AjaxSubmitLinkBlockUI("btnPost") {
            @Override
            protected void onSubmit(AjaxRequestTarget target) {
                super.onSubmit(target);
                onPost(target, openAIInputModel);
                target.appendJavaScript(";var c = $('#" + content.getMarkupId() + "');c.val('');c.focus();");
            }

            @Override
            protected void onError(AjaxRequestTarget target) {
                super.onError(target);
                target.add(chatForm);
            }
        };
        AjaxLink<Void> btnSummary = new AjaxLinkBlockUI<>("btnSummary") {

            @Override
            public void onClick(AjaxRequestTarget target) {
                onSummary(target, openAIInputModel);
            }

        };
        btnSummary.setVisible(chatPageModel.getObject().getActive() == 3); // 第二階段要顯示，但因為next page是3所以帶3
        btnSummary.setVisible(chatPageModel.getObject().getActive() == 0); // 第四階段要顯示，但因為next page是0所以帶0

        AjaxLink<Void> btnNext = new AjaxLinkBlockUI<>("btnNext") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                onNext(target, chatPageModel);
            }
        };
        chatForm.add(content).add(btnPost).add(btnSummary).add(btnNext);
        FeedbackPanel feedbackPanel = new FeedbackPanel("feedback");
        feedbackPanel.setOutputMarkupId(true);
        add(chatForm).add(feedbackPanel);

        //語音輸入
        Form<Void> audioForm = new Form<>("audioForm");
        audioForm.setMultiPart(true);
        chatForm.add(audioForm);

        uploadField = new FileUploadField("upload");
        uploadField.setOutputMarkupId(true);
        audioForm.add(uploadField);

        //按鈕後錄音
        btnRecord = new AjaxLink<>("btnRecord") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                logger.debug("Audio Recording...");
                // 直接把實際 id 帶進 JS，避免取錯
                String recordId = btnRecord.getMarkupId(true);
                String uploadId = uploadField.getMarkupId(true);
                String submitId = btnAudioUpload.getMarkupId(true);
                target.appendJavaScript(
                        ";toggleRecording('" +
                                recordId + "','" +
                                uploadId + "','" +
                                submitId + "'" +
                                ");"
                );
            }
        };
        btnRecord.setOutputMarkupId(true);
        audioForm.add(btnRecord);

        btnAudioUpload = new AjaxSubmitLinkBlockUI("btnAudioUpload", audioForm) {
            @Override
            protected void onSubmit(AjaxRequestTarget target) {
                FileUpload fu = uploadField.getFileUpload();

                if (fu != null) {
                    try {
                        Path dir = Paths.get(AIConstants.AUDIO_STORAGE_PATH);
                        if (Files.notExists(dir)) {
                            Files.createDirectories(dir);
                        }

                        File newFile = new File(dir.toFile(), getWicketSession().getId().concat("-").concat(Instant.now().toString()).concat(".webm"));
                        fu.writeTo(newFile);

                        //start transcript and update user chatpanel
                        openAIInputModel.setContent(
                                newFile.getAbsolutePath()
                        );
                        //將檔名當參數傳送給對話視窗，再轉送到翻譯及更新使用者聊天PANEL
                        onRecording(target, openAIInputModel);
                    } catch (Exception e) {
                        logger.debug("上傳失敗： {}", e.getMessage());
                    }
                } else {
                    logger.debug("沒有收到音訊檔案");
                }
            }

            @Override
            protected void onError(AjaxRequestTarget target) {
                super.onError(target);
                target.add(chatForm);
            }
        };
        btnAudioUpload.setOutputMarkupId(true);
        chatForm.add(btnAudioUpload);

        //todo:目前還無法使用
        // btnAudioUpload.setVisible(false);
    }

    /**
     * 讓按鈕後的功能由原始頁面去實作
     */
    public abstract void onPost(AjaxRequestTarget target, OpenAIInputModel openAIInputModel);

    /**
     * 按下按鈕後請AI總結
     */
    public abstract void onSummary(AjaxRequestTarget target, OpenAIInputModel openAIInputModel);

    /**
     * 按下按鈕後進入下一步驟
     */
    public abstract void onNext(AjaxRequestTarget target, IModel<ChatPageModel> chatPageModel);

    public abstract void onRecording(AjaxRequestTarget target, OpenAIInputModel openAIInputModel);


    @Override
    public void renderHead(IHeaderResponse response) {
        super.renderHead(response);
        // 引入 recorder.js
        response.render(JavaScriptHeaderItem.forUrl("/assets/js/recorder.js"));
    }

}
