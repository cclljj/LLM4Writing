package tw.com.slsinfo.panel;

import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.IModel;

/**
 * 回頂端按鈕
 */
public class BackToTopPanel extends Panel {
    public BackToTopPanel(String id) {
        super(id);
    }

    public BackToTopPanel(String id, IModel<?> model) {
        super(id, model);
    }
}
