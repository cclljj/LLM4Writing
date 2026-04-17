package tw.com.slsinfo.modal.course;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.form.AjaxSubmitLink;
import org.apache.wicket.core.request.handler.IPartialPageRequestHandler;
import org.apache.wicket.markup.html.form.*;
import org.apache.wicket.markup.html.panel.FeedbackPanel;
import org.apache.wicket.model.CompoundPropertyModel;
import tw.com.slsinfo.commons.wicket.components.blockui.AjaxSubmitLinkBlockUI;
import tw.com.slsinfo.commons.wicket.modal.BaseModal;
import tw.com.slsinfo.essayai.controls.EssayDropDownChoice;
import tw.com.slsinfo.essayai.models.course.EssayViewModel;
import tw.com.slsinfo.essayai.models.course.OpenClassModel;

import java.util.Set;

public class CreateOpenclassModal extends BaseModal<OpenClassModel> {
    private static final Logger logger = LogManager.getLogger(CreateOpenclassModal.class);

    private StatelessForm<OpenClassModel> formModal;

    private OpenClassModel model;

    private TextField<String> classname;
    private NumberTextField<Integer> discussiontime;
    private TextArea<String> supplementarytxt;
    private TextField<String> enable;
    private int eid;
    private Integer sid;
    private FeedbackPanel feedbackPanel;
    private String llmtype;

    private transient Validator validator;

    public CreateOpenclassModal(String id, Integer sid, String llmtype) {
        super(id);
        this.sid = sid;
        this.llmtype = llmtype;
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        model = new OpenClassModel();
        formModal = new StatelessForm<>("formModal");
        feedbackPanel = new FeedbackPanel("feedbackPanel");
        feedbackPanel.setOutputMarkupId(true);
        classname = new TextField<>("classname");
        discussiontime = new NumberTextField<>("discussiontime");
        supplementarytxt = new TextArea<>("supplementarytxt");
        enable = new TextField<>("enable");

        //需要將sid傳入EssayDropDownChoice以供初始化選擇清單
        DropDownChoice<EssayViewModel> essayViewDropDownChoice = new EssayDropDownChoice("essay", sid, llmtype) {
            @Override
            protected void setDefault() {
//                model.setEssay(getOnlyIfSingleChoice());
            }
        };

        AjaxSubmitLink submit = new AjaxSubmitLinkBlockUI("submit", formModal) {
            @Override
            protected void onSubmit(AjaxRequestTarget target) {
                super.onSubmit(target);
                model.setEnable("1");
                ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
                validator = factory.getValidator();
                Set<ConstraintViolation<OpenClassModel>> violations = validator.validate(model);
                if (!violations.isEmpty()) {
                    violations.forEach(e -> {
                        error(e.getMessage());
                    });
                    target.add(feedbackPanel);
                } else {
                    onResponse(model, target);
                }
            }

            @Override
            protected void onError(AjaxRequestTarget target) {
                super.onError(target);
                target.add(feedbackPanel);
            }
        };

        formModal.add(classname, essayViewDropDownChoice, discussiontime, supplementarytxt, enable);
        formModal.add(feedbackPanel, submit);
        formModal.setDefaultModel(new CompoundPropertyModel<>(model));
        formModal.setOutputMarkupId(true);
        add(formModal);
    }

    @Override
    public void setModelObject(OpenClassModel openClassModel) {
        super.setModelObject(openClassModel);
    }

    @Override
    public void show(IPartialPageRequestHandler partialPageRequestHandler) {
        partialPageRequestHandler.add(formModal);
        super.show(partialPageRequestHandler);
    }
}
