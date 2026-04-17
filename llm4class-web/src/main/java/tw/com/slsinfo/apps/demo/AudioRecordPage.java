package tw.com.slsinfo.apps.demo;

import com.openai.models.audio.AudioModel;
import com.openai.models.audio.transcriptions.Transcription;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.ajax.markup.html.form.AjaxButton;
import org.apache.wicket.markup.head.IHeaderResponse;
import org.apache.wicket.markup.head.JavaScriptHeaderItem;
import org.apache.wicket.markup.html.form.Form;
import org.apache.wicket.markup.html.form.upload.FileUpload;
import org.apache.wicket.markup.html.form.upload.FileUploadField;
import org.apache.wicket.markup.html.basic.Label;
import org.apache.wicket.model.Model;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;
import tw.com.slsinfo.essayai.services.OpenAIAPIService;

import java.io.File;

@MountPath("/apps/audio")
public class AudioRecordPage extends BaseAppPage {
    private static final Logger logger = LoggerFactory.getLogger(AudioRecordPage.class);

    private FileUploadField uploadField;
    private AjaxLink<Void> recordLink;
    private AjaxButton submitBtn;
    private Label result;

    public AudioRecordPage() {
        Form<Void> form = new Form<>("form");
        form.setMultiPart(true);
        add(form);

        uploadField = new FileUploadField("upload");
        uploadField.setOutputMarkupId(true);
        form.add(uploadField);

        result = new Label("result", Model.of(""));
        result.setOutputMarkupId(true);
        form.add(result);

        recordLink = new AjaxLink<>("recordBtn") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                // 直接把實際 id 帶進 JS，避免取錯
                String recordId = recordLink.getMarkupId(true);
                String uploadId = uploadField.getMarkupId(true);
                String submitId = submitBtn.getMarkupId(true);
                target.appendJavaScript(
                        "toggleRecording(" +
                                "'" + recordId + "'," +
                                "'" + uploadId + "'," +
                                "'" + submitId + "'" +
                                ");"
                );
            }
        };
        recordLink.setOutputMarkupId(true);
        form.add(recordLink);

        submitBtn = new AjaxButton("submitBtn", form) {
            @Override
            protected void onSubmit(AjaxRequestTarget target) {
                FileUpload fu = uploadField.getFileUpload();


                if (fu != null) {
                    try {
                        File dir = new File("/opt/recordings");
                        dir.mkdirs();
                        File newFile = new File(dir, fu.getClientFileName());
                        fu.writeTo(newFile);

                        Transcription transcription = OpenAIAPIService.AudioTranscriptions(newFile, AudioModel.GPT_4O_MINI_TRANSCRIBE);
                        logger.debug("transcription: {}", transcription.text());

//                        openAIClassChatUpdaterService.doSendAsyncUserPrompt(getWicketApplication(), getWicketSession().getId(), getOpenAIClientAsync(), transcription.text(), "");

                        result.setDefaultModelObject("已存檔：" + newFile.getAbsolutePath());
                    } catch (Exception e) {
                        result.setDefaultModelObject("上傳失敗：" + e.getMessage());
                    }
                } else {
                    result.setDefaultModelObject("沒有收到檔案");
                }
                target.add(result);
            }
        };
        submitBtn.setOutputMarkupId(true);
        form.add(submitBtn);
    }

    @Override
    public void renderHead(IHeaderResponse response) {
        super.renderHead(response);
        // 引入 recorder.js
        response.render(JavaScriptHeaderItem.forUrl("/assets/js/recorder.js"));
    }

}