package tw.com.slsinfo.panel.wrapper.main;

import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.IModel;

public class BannerPanel extends Panel {
    public BannerPanel(String id) {
        super(id);
    }

    public BannerPanel(String id, IModel<?> model) {
        super(id, model);
    }
}
