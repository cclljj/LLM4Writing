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
import org.apache.wicket.markup.html.form.NumberTextField;
import org.apache.wicket.markup.html.form.StatelessForm;
import org.apache.wicket.markup.html.form.TextArea;
import org.apache.wicket.markup.html.form.TextField;
import org.apache.wicket.markup.html.panel.FeedbackPanel;
import org.apache.wicket.model.CompoundPropertyModel;
import org.apache.wicket.model.IModel;
import tw.com.slsinfo.commons.wicket.components.blockui.AjaxSubmitLinkBlockUI;
import tw.com.slsinfo.commons.wicket.modal.BaseModal;
import tw.com.slsinfo.essayai.controls.EssayDropDownChoice;
import tw.com.slsinfo.essayai.controls.SelectOptionDropDownChoice;
import tw.com.slsinfo.essayai.models.SelectOption;
import tw.com.slsinfo.essayai.models.course.OpenClassesView;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

public class ModifyOpenclassModal extends BaseModal<OpenClassesView> {
    private static final Logger logger = LogManager.getLogger(ModifyOpenclassModal.class);

    private StatelessForm<OpenClassesView> formModal;
    private OpenClassesView model;
    private TextField<String> classname;
    private NumberTextField<Integer> discussiontime;
    private TextArea<String> supplementarytxt;
    private Integer sid;
    private EssayDropDownChoice essayViewDropDownChoice;
    private SelectOptionDropDownChoice enableViewDropDownChoice;
    private FeedbackPanel feedbackPanel;
    private transient Validator validator;
    private String llmtype;

    // 狀態選項列表
    private static final List<SelectOption> STATUS_OPTIONS = Arrays.asList(
            new SelectOption("1", "啟用"),
            new SelectOption("0", "停用")
    );

    public ModifyOpenclassModal(String id, Integer sid, String llmtype) {
        super(id);
        this.sid = sid;
        this.llmtype = llmtype;
        init();
    }

    private void init() {
        model = new OpenClassesView();
        formModal = new StatelessForm<>("formModal");
        formModal.setDefaultModel(new CompoundPropertyModel<>(model));
        formModal.setOutputMarkupId(true);

        feedbackPanel = new FeedbackPanel("feedbackPanel");
        feedbackPanel.setOutputMarkupId(true);

        classname = new TextField<>("classname");
        discussiontime = new NumberTextField<>("discussiontime");
        supplementarytxt = new TextArea<>("supplementarytxt");

        //傳入sid
        essayViewDropDownChoice = new EssayDropDownChoice("essay", sid, llmtype);

        enableViewDropDownChoice = new SelectOptionDropDownChoice(true, "enable", STATUS_OPTIONS) {
            @Override
            protected void setDefault() {
            }

            @Override
            public SelectOption getObject(String id, IModel<? extends List<? extends SelectOption>> choices) {
                logger.debug("ModifyOpenclassModal.getObject 被呼叫，id: {}", id);
                if (id == null) return null;

                SelectOption result = STATUS_OPTIONS.stream()
                        .filter(option -> option.getValue().equals(id))
                        .findFirst()
                        .orElse(null);

                logger.debug("ModifyOpenclassModal.getObject 結果: {}", result);
                return result;
            }
        };

        // 使用自定義模型而不是 CompoundPropertyModel
        enableViewDropDownChoice.setModel(enableModel);

        // 重要：確保正確設定必要屬性
        enableViewDropDownChoice.setRequired(true);
        enableViewDropDownChoice.setOutputMarkupId(true);

        formModal.add(classname, essayViewDropDownChoice, discussiontime, enableViewDropDownChoice, supplementarytxt);

        AjaxSubmitLink submit = new AjaxSubmitLinkBlockUI("submit", formModal) {
            @Override
            protected void onSubmit(AjaxRequestTarget target) {
                super.onSubmit(target);
                logger.debug("提交表單，model: {}", model);
                logger.debug("選擇的enable值: {}", model.getEnable());

                ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
                validator = factory.getValidator();
                Set<ConstraintViolation<OpenClassesView>> violations = validator.validate(model);
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

        formModal.add(feedbackPanel, submit);
        add(formModal);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
    }

    @Override
    public void setModelObject(OpenClassesView openClassesView) {
        this.model = openClassesView;
        formModal.setDefaultModel(new CompoundPropertyModel<>(model));
        enableViewDropDownChoice.modelChanged();
        essayViewDropDownChoice.setModelObjectFromView(openClassesView, llmtype);
    }

    @Override
    public void show(IPartialPageRequestHandler partialPageRequestHandler) {
        partialPageRequestHandler.add(formModal);
        super.show(partialPageRequestHandler);
    }

    IModel<SelectOption> enableModel = new IModel<SelectOption>() {
        @Override
        public SelectOption getObject() {
            String enableValue = model.getEnable();
            if (enableValue != null) {
                SelectOption result = STATUS_OPTIONS.stream()
                        .filter(option -> option.getValue().equals(enableValue))
                        .findFirst()
                        .orElse(null);
                return result;
            }
            return null;
        }

        @Override
        public void setObject(SelectOption object) {
            if (object != null) {
                model.setEnable(object.getValue());
            } else {
                model.setEnable(null);
            }
        }
    };
}