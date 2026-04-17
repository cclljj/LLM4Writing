package tw.com.slsinfo.panel;

import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.IModel;

/**
 * Bootstrap off-canvas component
 */
public class OffCanvasPanel extends Panel {

    public OffCanvasPanel(String id) {
        super(id);
    }

    public OffCanvasPanel(String id, IModel<?> model) {
        super(id, model);
    }
}
