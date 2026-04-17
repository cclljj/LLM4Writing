package tw.com.slsinfo.panel;

import org.apache.wicket.markup.html.link.Link;
import org.apache.wicket.model.IModel;
import tw.com.slsinfo.basic.BasePanel;
import tw.com.slsinfo.signin.LoginPage;

public class UserLogoPanel extends BasePanel {
    public UserLogoPanel(String id) {
        super(id);
    }

    public UserLogoPanel(String id, IModel<?> model) {
        super(id, model);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();

        add(new Link<>("signin") {
            @Override
            public void onClick() {
                setResponsePage(LoginPage.class);
            }
        });
    }
}
