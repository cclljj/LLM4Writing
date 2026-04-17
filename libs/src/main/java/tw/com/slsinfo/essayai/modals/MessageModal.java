package tw.com.slsinfo.essayai.modals;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.core.request.handler.IPartialPageRequestHandler;
import org.apache.wicket.markup.html.basic.Label;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.Model;
import tw.com.slsinfo.commons.wicket.components.blockui.AjaxLinkBlockUI;
import tw.com.slsinfo.commons.wicket.modal.BaseModal;
import tw.com.slsinfo.essayai.models.ActionType;
import tw.com.slsinfo.essayai.models.ConfirmModel;

public class MessageModal extends BaseModal<ConfirmModel> {

    private static final Logger logger = LogManager.getLogger(MessageModal.class);

    private IModel<String> message;

    private ConfirmModel confirmModel;

    private Label label;

    public MessageModal(String id) {
        super(id);
        this.message = Model.of("");
        init();
    }

    public MessageModal(String id, String message) {
        super(id);
        this.message = Model.of(message);
        init();
    }

    private void init() {
        label = new Label("message", message);
        label.setOutputMarkupId(true);
        confirmModel = new ConfirmModel();
        AjaxLink<Void> onClick = new AjaxLinkBlockUI<>("onClick") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                onResponse(confirmModel, target);
            }
        };
        add(label, onClick);
    }

    public MessageModal setMessage(IModel<String> message) {
        this.message = message;
        label.setDefaultModel(message);
        return this;
    }

    public MessageModal setMessage(String message) {
        this.message = Model.of(message);
        label.setDefaultModel(this.message);
        return this;
    }

    public void setActionType(ActionType actionType) {
        this.confirmModel.setActionType(actionType);
    }

    public IModel<String> getMessage() {
        return message;
    }

    public String getMessageString() {
        return message.getObject();
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        setOutputMarkupId(true);
    }

    @Override
    protected void onResponse(ConfirmModel confirmModel, IPartialPageRequestHandler iPartialPageRequestHandler) {
        super.onResponse(confirmModel, iPartialPageRequestHandler);
    }

    @Override
    public void show(IPartialPageRequestHandler partialPageRequestHandler) {
        partialPageRequestHandler.add(label);
        super.show(partialPageRequestHandler);
    }
}
