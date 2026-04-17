package tw.com.slsinfo.basic;

import com.openai.client.OpenAIClient;
import com.openai.client.OpenAIClientAsync;
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
import tw.com.slsinfo.commons.wicket.components.blockui.JQueryBlockUI;
import tw.com.slsinfo.panel.*;


/**
 * Base Page for project, not login yet
 */
public abstract class BasePage extends WebPage {
    public BasePage() {
    }

    public BasePage(IModel<?> model) {
        super(model);
    }

    public BasePage(PageParameters parameters) {
        super(parameters);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        add(new PreloaderPanel("preloader"));
        add(new HeaderPanel("header-area"));
        //add(new OffCanvasPanel("offcanvas-area"));
        //add(new FooterPanel("footer-area"));
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
}
