package tw.com.slsinfo.panel;

import org.apache.wicket.markup.html.basic.Label;
import org.apache.wicket.markup.html.link.Link;
import org.apache.wicket.model.IModel;
import tw.com.slsinfo.basic.BasePanel;
import tw.com.slsinfo.signin.LoginPage;

public class HeaderTopBar extends BasePanel {
    public HeaderTopBar(String id) {
        super(id);
    }

    public HeaderTopBar(String id, IModel<?> model) {
        super(id, model);
    }


    @Override
    protected void onInitialize() {
        super.onInitialize();
        add(new Link<>("login") {
            @Override
            public void onClick() {
                setResponsePage(LoginPage.class);
            }
        });
        add(new Label("revision", () -> getWicketApplication().loadRevisionString()));
    }
}
