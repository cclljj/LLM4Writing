package tw.com.slsinfo.panel;

import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.IModel;

public class PreloaderPanel extends Panel {
    public PreloaderPanel(String id) {
        super(id);
    }

    public PreloaderPanel(String id, IModel<?> model) {
        super(id, model);
    }
}
