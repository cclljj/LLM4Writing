package tw.com.slsinfo.apps.course.phase;

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
import org.apache.wicket.protocol.ws.api.message.ClosedMessage;
import org.apache.wicket.protocol.ws.api.message.ConnectedMessage;
import org.apache.wicket.protocol.ws.api.message.TextMessage;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.apps.demo.GPTPanel;
import tw.com.slsinfo.apps.demo.StudentChatPanel;
import tw.com.slsinfo.basic.BaseChatPage;
import tw.com.slsinfo.essayai.models.openai.*;
import tw.com.slsinfo.panel.chat.AudioChatFormPanel;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 小組與GPT聊天Panel
 */
@MountPath("apps/phase4")
public class Phase4Page extends BaseChatPage {
    private static final long serialVersionUID = 1L;
    private static final Logger logger = LogManager.getLogger(Phase4Page.class);
    private RepeatingView messages;
    private WebMarkupContainer chatpanel;
    private AtomicReference<String> scrollToMarkupId;
    private AtomicReference<OpenAIInputModel> openAIInputModelReference;
    private String previousmsgid;
    private String next_messageid;
    private String next_previousmsgid;
    private AudioChatFormPanel audioChatFormPanel;
    //同組學生才能收到訊息
    private int groupid;

    public Phase4Page(IModel<ChatPageModel> model, int currentStageId) {
        super(model, currentStageId);
        this.groupid = getChatPageModel().getObject().getGroupid();
    }

    public Phase4Page(PageParameters parameters) {
        super(parameters);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        previousmsgid = getChatPageModel().getObject().getPreviousId();
        groupid = getWicketSession().getGroupid();
        chatpanel = new WebMarkupContainer("chatpanel");
        chatpanel.setOutputMarkupId(true);
        logger.debug("ChatPanel ID : {}", chatpanel.getMarkupId());
        messages = new RepeatingView("messages");
        messages.setOutputMarkupId(true);
        logger.debug("Messages ID : {}", messages.getMarkupId());
        chatpanel.add(messages);
        //Auto scroll to latest panel
        scrollToMarkupId = new AtomicReference<>("");

        ChatPageModel chatPageModel = getChatPageModel().getObject();
        chatPageModel.setActive(0);
        logger.debug("ChatPageModel : {}", chatPageModel);

        openAIInputModelReference = new AtomicReference<>();
        audioChatFormPanel = new AudioChatFormPanel("audioChatFormPanel", Model.of(chatPageModel)) {
            @Override
            public void onPost(AjaxRequestTarget target, OpenAIInputModel model) {
                openAIInputModelReference.set(model);
                model.setContent("我是".concat(getWicketSession().getTrueName()).concat("，").concat(model.getContent()));
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
                String msg = "請你根據{LLMClass2-2}檔案內容，將我們的對話進行收尾任務。";

                getOpenAIClassChatUpdaterService().doSendGroupAsyncUserPrompt(getWicketApplication(), getWicketSession().getId(), getOpenAIClientAsync(), msg, previousmsgid, Optional.of(groupid));
            }

            @Override
            public void onNext(AjaxRequestTarget target, IModel<ChatPageModel> chatPageModel) {
                boolean saved = saveStagelog(next_previousmsgid, next_messageid,getCurrentStageId() + 1);
                if (saved) {
                    logger.debug("Phase{} stagelog record saved successfully",getCurrentStageId() + 1);
                }
                setResponsePage(new Phase5Page(chatPageModel, getCurrentStageId() + 1));
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
                //SameClassMemberIndex.onConnect(groupid, message);
                logger.debug("WebSocket Connected : {}", message);
                List<String> systemPrompts = new ArrayList<>();
                systemPrompts.add("你的角色必須根據{LLMWritingSetting},{LLMWirting2-1}檔案內容來設定。請跟學生打招呼及自我介紹，並直接開始引導學生進行討論。");
                systemPrompts.add("討論題目: " + chatPageModel.getTitle());
                systemPrompts.add("補充資料: " + chatPageModel.getInitPrompts());

                getOpenAIClassChatUpdaterService().doSetGroupSystemPrompt(getWicketApplication(), getWicketSession().getId(), getOpenAIClientAsync(), systemPrompts, Optional.of(getVectorId()), Optional.empty());
            }


            @Override
            protected void onClose(ClosedMessage message) {
                super.onClose(message);
                logger.debug("WebSocket Close : {}", message);
                //SameClassMemberIndex.onClose(groupid, message);
            }

            @Override
            protected void onMessage(WebSocketRequestHandler handler, TextMessage message) {
                super.onMessage(handler, message);
                logger.debug("Group WebSocket Message : {}", message.getText());
                logger.debug("Group WebSocket Message SessionId : {} , Server SessionId : {}", message.getSessionId(), getWicketSession().getId());
                //不同使用者輸入訊息時，會更新同小組前端頁面，顯示某使用者的訊息
                getOpenAIClassChatUpdaterService().doUpdateGroupUserChatPanel(getWicketApplication(), getWicketSession().getId(), message.getText(), Optional.of(groupid));
                //start gpt api and update gpt panel
                logger.debug("Ready to request api : {}", message.getSessionId());
                logger.debug("Previous msgid: {}", previousmsgid);

                getOpenAIClassChatUpdaterService().doSendGroupAsyncUserPrompt(getWicketApplication(), getWicketSession().getId(), getOpenAIClientAsync(), message.getText(), previousmsgid, Optional.of(groupid));
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
                next_messageid = aiResponseIDPushMessage.getAiResponseModel().getMessageid();
                next_previousmsgid = aiResponseIDPushMessage.getAiResponseModel().getResponseid();
                logger.debug("System Prompt Message ID : {}", previousmsgid);
                getChatPageModel().getObject().setPreviousId(previousmsgid);

                if (previousmsgid != null) {
                    boolean saved = saveStagelog(aiResponseIDPushMessage.getAiResponseModel().getResponseid(), aiResponseIDPushMessage.getAiResponseModel().getMessageid());
                    if (saved) {
                        logger.debug("Phase1 stagelog record saved successfully");
                    }
                }

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
            } else if (payload.getMessage() instanceof UserPushMessage) {
                UserPushMessage userPushMessage = (UserPushMessage) payload.getMessage();
                WebSocketRequestHandler handler = payload.getHandler();

                Panel panel = new StudentChatPanel(messages.newChildId(), userPushMessage.getContent());
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
                //handler.appendJavaScript(";Wicket.WebSocket.send('" + userPushMessage.getContent() + "');");
                //openAIWritingChatUpdaterService.doSendGroupAsyncUserPrompt(getWicketApplication(), getWicketSession().getId(), getOpenAIClientAsync(), userPushMessage.getContent(), previousmsgid, Optional.of(groupid));
            }
        }

    }


}