package tw.com.slsinfo.panel.app.progress;

import org.apache.wicket.behavior.AttributeAppender;
import org.apache.wicket.markup.html.WebMarkupContainer;
import org.apache.wicket.model.IModel;
import tw.com.slsinfo.basic.BasePanel;


/**
 * 活動流程選單
 */
public class ProgressPanel extends BasePanel {

    private final int active;

    public ProgressPanel(String id, int active) {
        super(id);
        this.active = active;
    }


    public ProgressPanel(String id, IModel<?> model, int active) {
        super(id, model);
        this.active = active;
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        for (int i = 1; i <= 3; i++) {
            WebMarkupContainer container = new WebMarkupContainer("phase" + i);
            if (i == active) {
                container.add(new AttributeAppender("class", " active"));
            }
            add(container);
        }

    }
}
