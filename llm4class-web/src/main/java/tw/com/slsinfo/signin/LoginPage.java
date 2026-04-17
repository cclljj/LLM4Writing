package tw.com.slsinfo.signin;

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
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.WicketApplication;
import tw.com.slsinfo.WicketSession;
import tw.com.slsinfo.commons.wicket.components.blockui.JQueryBlockUI;
import tw.com.slsinfo.panel.BackToTopPanel;
import tw.com.slsinfo.panel.PreloaderPanel;
import tw.com.slsinfo.panel.SignInPanel;
import tw.com.slsinfo.panel.SwitchThemePanel;

@MountPath("/signin")
public class LoginPage extends WebPage {
    public LoginPage() {
    }

    public LoginPage(IModel<?> model) {
        super(model);
    }

    public LoginPage(PageParameters parameters) {
        super(parameters);
    }


    protected final WicketApplication getWicketApplication() {
        return (WicketApplication) Application.get();
    }

    protected final WicketSession getWicketSession() {
        return (WicketSession) Session.get();
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        add(new PreloaderPanel("preloader"));
        add(new SignInPanel("signin"));
        add(new BackToTopPanel("backtotop"));
        add(new SwitchThemePanel("switcher"));
        add(new HeaderResponseContainer("footer-container", "footer-container"));
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
}
