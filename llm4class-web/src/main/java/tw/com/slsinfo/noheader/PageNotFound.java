package tw.com.slsinfo.noheader;

import org.apache.wicket.markup.html.link.Link;
import org.apache.wicket.model.Model;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.HomePage;
import tw.com.slsinfo.basic.BasePage;

import java.io.Serial;

/**
 * 404 not found page
 */
@MountPath("/404")
public class PageNotFound extends BasePage {
    @Serial
    private static final long serialVersionUID = 1L;

    public PageNotFound() {
        super();
    }


    @Override
    protected void onInitialize() {
        super.onInitialize();
        add(new Link<>("homelink", Model.of("回到首頁")) {
            @Override
            public void onClick() {
                setResponsePage(HomePage.class);;
            }
        });
    }
}
