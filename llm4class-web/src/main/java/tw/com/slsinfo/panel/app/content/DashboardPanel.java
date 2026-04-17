package tw.com.slsinfo.panel.app.content;

import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.IModel;

public class DashboardPanel extends Panel {
    public DashboardPanel(String id) {
        super(id);
    }

    public DashboardPanel(String id, IModel<?> model) {
        super(id, model);
    }
}
