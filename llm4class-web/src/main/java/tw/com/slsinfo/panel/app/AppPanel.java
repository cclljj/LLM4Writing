package tw.com.slsinfo.panel.app;

import org.apache.wicket.model.IModel;
import tw.com.slsinfo.basic.BasePanel;

/**
 * 登入後主要頁面內容HTML
 */
public class AppPanel extends BasePanel {
    public AppPanel(String id) {
        super(id);
    }

    public AppPanel(String id, IModel<?> model) {
        super(id, model);
    }
}
