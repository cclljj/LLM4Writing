package tw.com.slsinfo.panel.wrapper.main;

import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.IModel;

public class BlogAreaPanel extends Panel {
    public BlogAreaPanel(String id) {
        super(id);
    }

    public BlogAreaPanel(String id, IModel<?> model) {
        super(id, model);
    }
}
