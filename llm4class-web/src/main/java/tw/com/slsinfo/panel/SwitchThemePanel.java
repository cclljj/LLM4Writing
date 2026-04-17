package tw.com.slsinfo.panel;


import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.IModel;

public class SwitchThemePanel extends Panel {
    public SwitchThemePanel(String id) {
        super(id);
    }

    public SwitchThemePanel(String id, IModel<?> model) {
        super(id, model);
    }
}
