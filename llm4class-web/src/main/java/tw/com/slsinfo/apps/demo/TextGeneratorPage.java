package tw.com.slsinfo.apps.demo;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.event.IEvent;
import org.apache.wicket.markup.html.WebMarkupContainer;
import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.markup.repeater.RepeatingView;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.Model;
import org.apache.wicket.protocol.ws.api.WebSocketBehavior;
import org.apache.wicket.protocol.ws.api.WebSocketRequestHandler;
import org.apache.wicket.protocol.ws.api.event.WebSocketPushPayload;
import org.apache.wicket.protocol.ws.api.message.ConnectedMessage;
import org.apache.wicket.protocol.ws.api.message.TextMessage;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseChatPage;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.essayai.models.openai.OpenAIInputModel;
import tw.com.slsinfo.essayai.models.openai.OpenAIResponseIDPushMessage;
import tw.com.slsinfo.essayai.models.openai.OpenAIResponsePushMessage;
import tw.com.slsinfo.essayai.services.OpenAIClassChatUpdaterService;
import tw.com.slsinfo.essayai.services.OpenAIWritingChatUpdaterService;
import tw.com.slsinfo.panel.chat.AudioChatFormPanel;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

@MountPath("/apps/textgenerator")
public class TextGeneratorPage extends BaseChatPage {

    private static final long serialVersionUID = 1L;
    private static final Logger logger = LogManager.getLogger(TextGeneratorPage.class);
    private RepeatingView messages;
    private WebMarkupContainer chatpanel;
    private AtomicReference<String> scrollToMarkupId;
    private AtomicReference<OpenAIInputModel> openAIInputModelReference;
    private OpenAIClassChatUpdaterService openAIClassChatUpdaterService;
    private String previousmsgid;
    private AudioChatFormPanel audioChatFormPanel;


    public TextGeneratorPage(IModel<ChatPageModel> model, int currentStageId) {
        super(model, currentStageId);
    }

    public TextGeneratorPage(PageParameters parameters) {
        super(parameters);
    }


    @Override
    protected void onInitialize() {
        super.onInitialize();
        openAIClassChatUpdaterService = CDI.current().select(OpenAIClassChatUpdaterService.class).get();
        chatpanel = new WebMarkupContainer("chatpanel");
        chatpanel.setOutputMarkupId(true);
        logger.debug("ChatPanel ID : {}", chatpanel.getMarkupId());
        messages = new RepeatingView("messages");
        messages.setOutputMarkupId(true);
        logger.debug("Messages ID : {}", messages.getMarkupId());
        chatpanel.add(messages);
        //Auto scroll to latest panel
        scrollToMarkupId = new AtomicReference<>("");


        openAIInputModelReference = new AtomicReference<>();
        audioChatFormPanel = new AudioChatFormPanel("audioChatFormPanel", () -> {
            ChatPageModel model = new ChatPageModel();
            model.setActive(1);
            return model;
        }) {
            @Override
            public void onPost(AjaxRequestTarget target, OpenAIInputModel model) {
                openAIInputModelReference.set(model);
                Panel panel = new StudentChatPanel(messages.newChildId(), model.getContent());
                panel.setOutputMarkupId(true);
                scrollToMarkupId.set(panel.getMarkupId());
                messages.add(panel);
                chatpanel.add(messages);
                target.add(chatpanel);
                target.appendJavaScript(
                        ";$('html,body')" +
                                "  .stop(true)" +
                                "  .animate({ scrollTop: $('#" + scrollToMarkupId.get() + "').offset().top }, 300);"
                );
                target.appendJavaScript(";Wicket.WebSocket.send('" + model.getContent() + "');");
            }

            @Override
            public void onSummary(AjaxRequestTarget target, OpenAIInputModel openAIInputModel) {

            }

            @Override
            public void onNext(AjaxRequestTarget target, IModel<ChatPageModel> chatPageModel) {

            }

            @Override
            public void onRecording(AjaxRequestTarget target, OpenAIInputModel openAIInputModel) {

            }
        };
        add(chatpanel, audioChatFormPanel);
        //Page接收使用者輸入的文字表單內容WebSocket Message
        add(new WebSocketBehavior() {
            @Override
            protected void onConnect(ConnectedMessage message) {
                super.onConnect(message);
                logger.debug("WebSocket Connected : {}", message);
                openAIClassChatUpdaterService.doSetSingleSystemPrompt(getWicketApplication(), getWicketSession().getId(), getOpenAIClientAsync(), "你的角色必須根據{LLMClassSetting}檔案內容來設定。並請跟學生打招呼及自我介紹。", getVectorId(), Optional.empty());
            }


            @Override
            protected void onMessage(WebSocketRequestHandler handler, TextMessage message) {
                super.onMessage(handler, message);
                logger.debug("WebSocket Message : {}", message.getText());
                logger.debug("WebSocket Message SessionId : {} , Server SessionId : {}", message.getSessionId(), getWicketSession().getId());

                //start gpt api and update gpt panel
                if (message.getSessionId().equals(getWicketSession().getId())) {
                    logger.debug("Ready to request api : {}", message.getSessionId());
                    logger.debug("Previous msgid: {}", previousmsgid);
                    openAIClassChatUpdaterService.doSendAsyncUserPrompt(getWicketApplication(), getWicketSession().getId(), getOpenAIClientAsync(), message.getText(), previousmsgid);
                }
            }


        });

    }


    /**
     * GPT API處理完畢後，使用WebSocket Push回來的訊息處理
     *
     * @param event
     */
    @Override
    public void onEvent(IEvent<?> event) {
        super.onEvent(event);

        if (event.getPayload() instanceof WebSocketPushPayload) {
            WebSocketPushPayload payload = (WebSocketPushPayload) event.getPayload();
            if (payload.getMessage() instanceof OpenAIResponsePushMessage) {
                WebSocketRequestHandler handler = payload.getHandler();
                OpenAIResponsePushMessage aiResponsePushMessage = (OpenAIResponsePushMessage) payload.getMessage();
                Panel panel = new GPTPanel(messages.newChildId(), Model.of(
                        aiResponsePushMessage.getContent()
                ));
                panel.setOutputMarkupId(true);
                scrollToMarkupId.set(panel.getMarkupId());
                messages.add(panel);
                chatpanel.add(messages);
                handler.add(chatpanel);
                handler.appendJavaScript(
                        ";$('html,body')" +
                                "  .stop(true)" +
                                "  .animate({ scrollTop: $('#" + scrollToMarkupId.get() + "').offset().top }, 300);"
                );
            } else if (payload.getMessage() instanceof OpenAIResponseIDPushMessage) {
                OpenAIResponseIDPushMessage aiResponseIDPushMessage = (OpenAIResponseIDPushMessage) payload.getMessage();
                previousmsgid = aiResponseIDPushMessage.getAiResponseModel().getMessageid();
                logger.debug("System Prompt Message ID : {}", previousmsgid);
                WebSocketRequestHandler handler = payload.getHandler();
                Panel panel = new GPTPanel(messages.newChildId(), Model.of(
                        aiResponseIDPushMessage.getAiResponseModel().getContent()
                ));
                panel.setOutputMarkupId(true);
                scrollToMarkupId.set(panel.getMarkupId());
                messages.add(panel);
                chatpanel.add(messages);
                handler.add(chatpanel);
                handler.appendJavaScript(
                        ";$('html,body')" +
                                "  .stop(true)" +
                                "  .animate({ scrollTop: $('#" + scrollToMarkupId.get() + "').offset().top }, 300);"
                );
            }
        }

    }

}
