package tw.com.slsinfo.apps.demo;

import org.apache.wicket.markup.html.basic.Label;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.Model;
import tw.com.slsinfo.basic.BasePanel;


/**
 * 使用者端發送訊息後顯示在頁面上的Panel
 */
public class StudentChatPanel extends BasePanel {
    private final IModel<String> message;

    public StudentChatPanel(String id, IModel<String> model) {
        super(id, model);
        message = model;
    }

    public StudentChatPanel(String id, String model) {
        this(id, Model.of(model));
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        add(new Label("stmessage", message));
    }
}
