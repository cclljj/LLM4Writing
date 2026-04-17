package tw.com.slsinfo.modal.system;

import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.ajax.markup.html.form.AjaxSubmitLink;
import org.apache.wicket.core.request.handler.IPartialPageRequestHandler;
import org.apache.wicket.markup.html.form.PasswordTextField;
import org.apache.wicket.markup.html.form.StatelessForm;
import org.apache.wicket.markup.html.form.validation.EqualPasswordInputValidator;
import org.apache.wicket.markup.html.panel.FeedbackPanel;
import org.apache.wicket.model.CompoundPropertyModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.wicket.modal.BaseModal;
import tw.com.slsinfo.essayai.models.system.ResetPwdModel;

/**
 * 重設密碼Modal
 */
public class ResetPwdModal extends BaseModal<ResetPwdModel> {

    private static final Logger logger = LoggerFactory.getLogger(ResetPwdModal.class);

    private StatelessForm<ResetPwdModel> formModal;

    private FeedbackPanel feedbackPanel;

    private ResetPwdModel model;

    public ResetPwdModal(String id) {
        super(id);
        init();
    }

    private void init() {
        model = new ResetPwdModel();
        formModal = new StatelessForm<>("formModal");

        PasswordTextField newPassword = new PasswordTextField("newPassword");
        newPassword.setRequired(true);

        PasswordTextField newPassword2 = new PasswordTextField("newPassword2");
        newPassword2.setRequired(true);

        feedbackPanel = new FeedbackPanel("feedbackPanel");
        feedbackPanel.setOutputMarkupId(true);

        formModal.add(newPassword).add(newPassword2).add(feedbackPanel).add(new EqualPasswordInputValidator(newPassword, newPassword2));
        formModal.setDefaultModel(new CompoundPropertyModel<>(model));
        formModal.setOutputMarkupId(true);

        AjaxSubmitLink submit = new AjaxSubmitLink("submit", formModal) {
            @Override
            protected void onSubmit(AjaxRequestTarget target) {
                super.onSubmit(target);

                onResponse(model, target);

                logger.debug("model {}", model.toString());
            }

            @Override
            protected void onError(AjaxRequestTarget target) {
                super.onError(target);
                target.add(feedbackPanel);
            }
        };

        AjaxLink<Void> btnClose = new AjaxLink<>("btnClose") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                close(target);
            }
        };

        formModal.add(submit, btnClose);
        add(formModal);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
    }

    @Override
    public void setModelObject(ResetPwdModel resetPwdModel) {
        super.setModelObject(resetPwdModel);
        this.model = resetPwdModel;
        formModal.setDefaultModel(new CompoundPropertyModel<>(model));
    }

    @Override
    public void show(IPartialPageRequestHandler partialPageRequestHandler) {
        partialPageRequestHandler.add(formModal);
        super.show(partialPageRequestHandler);
    }
}
