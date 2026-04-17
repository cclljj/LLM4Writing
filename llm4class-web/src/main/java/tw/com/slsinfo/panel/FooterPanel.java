package tw.com.slsinfo.panel;

import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.IModel;

public class FooterPanel extends Panel {
    public FooterPanel(String id) {
        super(id);
    }

    public FooterPanel(String id, IModel<?> model) {
        super(id, model);
    }
}
