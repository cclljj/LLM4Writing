package tw.com.slsinfo.basic;

import com.beust.jcommander.Strings;
import com.openai.client.OpenAIClient;
import com.openai.client.OpenAIClientAsync;
import jakarta.enterprise.inject.spi.CDI;
import jakarta.inject.Inject;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.Application;
import org.apache.wicket.Session;
import org.apache.wicket.markup.head.*;
import org.apache.wicket.markup.head.filter.HeaderResponseContainer;
import org.apache.wicket.markup.html.WebPage;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.LoadableDetachableModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.apache.wicket.resource.JQueryResourceReference;
import tw.com.slsinfo.WicketApplication;
import tw.com.slsinfo.WicketSession;
import tw.com.slsinfo.apps.stlearning.ActivityPage;
import tw.com.slsinfo.commons.wicket.components.blockui.JQueryBlockUI;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.essayai.chatroom.SameClassMemberIndex;
import tw.com.slsinfo.essayai.services.*;
import tw.com.slsinfo.panel.BackToTopPanel;
import tw.com.slsinfo.panel.PreloaderPanel;
import tw.com.slsinfo.panel.SwitchThemePanel;
import tw.com.slsinfo.panel.app.AppFooter;
import tw.com.slsinfo.panel.app.AppHeaderPanel;
import tw.com.slsinfo.panel.app.AppSideBarHeader;
import tw.com.slsinfo.panel.app.AppSideBarWrapper;

import java.util.List;


/**
 * 與AI對話基本頁面
 */
public class BaseChatPage extends WebPage {

    private static final Logger logger = LogManager.getLogger(BaseChatPage.class);

    @Inject
    protected OpenAITokenService openAITokenService;

    @Inject
    protected GroupService groupService;

    @Inject
    private ChatLogsService chatLogsService;

    @Inject
    private OpenAIClassChatUpdaterService openAIClassChatUpdaterService;

    private final IModel<ChatPageModel> chatPageModel;
    private final int currentStageId;


    public BaseChatPage(IModel<ChatPageModel> model, int currentStageId) {
        super(model);
        this.currentStageId = currentStageId;
        this.chatPageModel = model;
    }

    public BaseChatPage() {
        this.chatPageModel = new LoadableDetachableModel<ChatPageModel>() {

            @Override
            protected ChatPageModel load() {
                ChatPageModel chatPageModel = new ChatPageModel();
                chatPageModel.setActive(1);
                chatPageModel.setGroupid(1);
                return chatPageModel;
            }
        };
        this.currentStageId = 1;
        setResponsePage(ActivityPage.class);
    }

    public BaseChatPage(PageParameters parameters) {
        super(parameters);
        this.chatPageModel = new LoadableDetachableModel<ChatPageModel>() {

            @Override
            protected ChatPageModel load() {
                ChatPageModel chatPageModel = new ChatPageModel();
                chatPageModel.setActive(1);
                chatPageModel.setGroupid(1);
                return chatPageModel;
            }
        };
        this.currentStageId = 1;
        setResponsePage(ActivityPage.class);
    }


    @Override
    protected void onInitialize() {
        super.onInitialize();
        openAITokenService = CDI.current().select(OpenAITokenService.class).get();
        groupService = CDI.current().select(GroupService.class).get();
        chatLogsService = CDI.current().select(ChatLogsService.class).get();
        openAIClassChatUpdaterService = CDI.current().select(OpenAIClassChatUpdaterService.class).get();

        add(new PreloaderPanel("preloader"));
        //add(new OffCanvasPanel("offcanvas-area"));
        add(new AppSideBarHeader("appsidebarheader"));
        // left menu bar
        add(new AppSideBarWrapper("appsidebarwrapper", true, chatPageModel.getObject().getActive()));
        add(new AppHeaderPanel("appheader"));
        add(new AppFooter("appfooter"));
        add(new BackToTopPanel("backtotop"));
        add(new SwitchThemePanel("switcher"));
        add(new HeaderResponseContainer("footer-container", "footer-container"));
    }


    protected final WicketApplication getWicketApplication() {
        return (WicketApplication) Application.get();
    }

    protected final WicketSession getWicketSession() {
        return (WicketSession) Session.get();
    }

    @Override
    public void renderHead(IHeaderResponse response) {
        super.renderHead(response);

        //Meta for CSP
        response.render(MetaDataHeaderItem.forMetaTag("csp-nonce", getWicketApplication().getCspSettings().getNonce(getRequestCycle())));

        //JavaScript
        response.render(JavaScriptHeaderItem.forReference(
                JQueryResourceReference.getV3()
        ));

        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/popper.min.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/vendor/bootstrap.bundle.min.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/waypoints.min.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/swiper.min.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/wow.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/vendor/magnific-popup.min.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/vendor/isotope.pkgd.min.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/vendor/imagesloaded.pkgd.min.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/nice-select.min.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/vendor/ajax-form.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/easypie.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/vendor/purecounter.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/vendor/backtotop.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/prism.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/typed.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/main.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/vendor/sidebar-menu.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/d3.v7.min.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/d3-org-chart.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/d3-flextree.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/go.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/orgChartExtras-init.js"));

        // jQuery Block UI
        response.render(OnDomReadyHeaderItem.forScript(JQueryBlockUI.getJS()));

    }


    /**
     * Get LLM4Writing Sync Client
     *
     * @return
     */
    public OpenAIClient getOpenAIClient() {
        return getWicketApplication().getOpenAIClient();
    }

    /**
     * Get LLM4Writing Async Client
     *
     * @return
     */
    public OpenAIClientAsync getOpenAIClientAsync() {
        return getWicketApplication().getOpenAIClientAsync();
    }

    /**
     * Group Chat Clients holder
     *
     * @return
     */
    public SameClassMemberIndex getChatGroupIndex() {
        return getWicketApplication().getChatGroupIndex();
    }

    public ChatLogsService getChatLogsService() {
        return chatLogsService;
    }

    public int getCurrentStageId() {
        return currentStageId;
    }

    public GroupService getGroupService() {
        return groupService;
    }

    public OpenAITokenService getOpenAITokenService() {
        return openAITokenService;
    }

    public OpenAIClassChatUpdaterService getOpenAIClassChatUpdaterService() {
        return openAIClassChatUpdaterService;
    }

    /**
     * Get ChatPageModel
     *
     * @return
     */
    public IModel<ChatPageModel> getChatPageModel() {
        return chatPageModel;
    }

    /**
     * OpenAI Vector Id
     *
     * @return
     */
    public String getVectorId() {
        return getWicketApplication().getVectorId();
    }

    /**
     * 共用方法：寫入 stagelog 記錄
     *
     * @param previousmsgid AI 回應的 message ID
     * @return 是否成功寫入
     */
    protected boolean saveStagelog(String previousmsgid, String messageId) {
        ChatPageModel chatPageModel = getChatPageModel().getObject();
        return CDI.current().select(StageService.class).get().saveStagelog(chatPageModel, previousmsgid, currentStageId, messageId, "0");
    }

    protected boolean saveStagelog(String previousmsgid, String messageId, int stageid) {
        ChatPageModel chatPageModel = getChatPageModel().getObject();
        return CDI.current().select(StageService.class).get().saveStagelog(chatPageModel, previousmsgid, stageid, messageId, "0");
    }

    protected boolean saveStagelog(String previousmsgid, String messageId, int stageid, String isend) {
        ChatPageModel chatPageModel = getChatPageModel().getObject();
        return CDI.current().select(StageService.class).get().saveStagelog(chatPageModel, previousmsgid, stageid, messageId, isend);
    }

    /**
     * 寫入對話記錄
     *
     * @param uid       使用者帳號
     * @param messages  給AI的訊息或是AI回覆的訊息
     * @param eventType 事件型態
     */
    protected void saveChatLogs(List<String> messages, EventType eventType) {
        CDI.current().select(ChatLogsService.class).get()
                .addChatLogs(getChatPageModel().getObject(), Strings.join("\n", messages), eventType);
    }

}
