package tw.com.slsinfo.panel;

import org.apache.wicket.markup.html.basic.Label;
import org.apache.wicket.markup.html.link.Link;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.Model;
import tw.com.slsinfo.HomePage;
import tw.com.slsinfo.basic.BasePanel;

public class UserProfileShotCut extends BasePanel {
    public UserProfileShotCut(String id) {
        super(id);
    }

    public UserProfileShotCut(String id, IModel<?> model) {
        super(id, model);
    }


    @Override
    protected void onInitialize() {
        super.onInitialize();

        add(new Label("truename", Model.of(getWicketSession().getTrueName())));
        add(new Label("title", Model.of(getWicketSession().getTitles())));
        add(new Label("revision", () -> getWicketApplication().loadRevisionString()));
        add(new Link<>("signout") {
            @Override
            public void onClick() {
                getSession().invalidate();
                setResponsePage(HomePage.class);
            }
        });
    }
}
