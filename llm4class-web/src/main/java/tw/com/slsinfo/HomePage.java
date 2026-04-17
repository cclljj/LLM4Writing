package tw.com.slsinfo;

import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BasePage;
import tw.com.slsinfo.panel.wrapper.main.*;

import java.io.Serial;


@MountPath("/home")
public class HomePage extends BasePage {
    @Serial
    private static final long serialVersionUID = 1L;

    public HomePage(final PageParameters parameters) {
        super(parameters);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
//        add(new BannerPanel("banner-area"));
//        add(new AboutPanel("about-area"));
//        add(new ServiceAreaPanel("service-area"));
//        add(new PartnerPanel("partner-area"));
//        add(new PricingPanel("pricing-area"));
//        add(new FAQPanel("faq-area"));
//        add(new BlogAreaPanel("blog-area"));
//        add(new CTAAreaPanel("cta-area"));
    }
}
