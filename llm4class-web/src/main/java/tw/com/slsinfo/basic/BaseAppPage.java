package tw.com.slsinfo.basic;

import com.openai.client.OpenAIClient;
import com.openai.client.OpenAIClientAsync;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.Application;
import org.apache.wicket.Session;
import org.apache.wicket.markup.head.IHeaderResponse;
import org.apache.wicket.markup.head.JavaScriptHeaderItem;
import org.apache.wicket.markup.head.MetaDataHeaderItem;
import org.apache.wicket.markup.head.OnDomReadyHeaderItem;
import org.apache.wicket.markup.head.filter.HeaderResponseContainer;
import org.apache.wicket.markup.html.WebPage;
import org.apache.wicket.model.IModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.apache.wicket.resource.JQueryResourceReference;
import tw.com.slsinfo.WicketApplication;
import tw.com.slsinfo.WicketSession;
import tw.com.slsinfo.apps.course.phase.Phase1Page;
import tw.com.slsinfo.commons.wicket.components.blockui.JQueryBlockUI;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.panel.BackToTopPanel;
import tw.com.slsinfo.panel.OffCanvasPanel;
import tw.com.slsinfo.panel.PreloaderPanel;
import tw.com.slsinfo.panel.SwitchThemePanel;
import tw.com.slsinfo.panel.app.AppFooter;
import tw.com.slsinfo.panel.app.AppHeaderPanel;
import tw.com.slsinfo.panel.app.AppSideBarHeader;
import tw.com.slsinfo.panel.app.AppSideBarWrapper;

/**
 * 已登入具備Session才會有左側選單
 */

public abstract class BaseAppPage extends WebPage {
    private static final Logger logger = LogManager.getLogger(BaseAppPage.class);

    public BaseAppPage() {
    }

    public BaseAppPage(IModel<?> model) {
        super(model);
    }

    public BaseAppPage(PageParameters parameters) {
        super(parameters);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        add(new PreloaderPanel("preloader"));
        //add(new OffCanvasPanel("offcanvas-area"));
        add(new AppSideBarHeader("appsidebarheader"));
        // left menu bar
        add(new AppSideBarWrapper("appsidebarwrapper", false, 0));
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

        // jQuery Block UI
        response.render(OnDomReadyHeaderItem.forScript(JQueryBlockUI.getJS()));

    }


    /**
     * Get LLM4Class Sync Client
     *
     * @return
     */
    public OpenAIClient getOpenAIClient() {
        return getWicketApplication().getOpenAIClient();
    }

    /**
     * Get LLM4Class Async Client
     *
     * @return
     */
    public OpenAIClientAsync getOpenAIClientAsync() {
        return getWicketApplication().getOpenAIClientAsync();
    }


    public WebPage createPhasePageByStageId(int stageId, IModel<ChatPageModel> model) {
        try {
            String className = Phase1Page.class.getPackage().getName() + ".Phase" + stageId + "Page";
            Class<?> pageClass = Class.forName(className);
            return (WebPage) pageClass.getDeclaredConstructor().newInstance();
        } catch (Exception e) {
            // 找不到對應頁面時，回傳預設頁面
            logger.debug("createPhasePageByStageId Exception:{}", e.getMessage());
            return new Phase1Page(model, stageId);
        }
    }

}
