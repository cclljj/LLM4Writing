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
import org.apache.wicket.markup.html.form.DropDownChoice;
import org.apache.wicket.markup.html.form.StatelessForm;
import org.apache.wicket.markup.html.form.TextArea;
import org.apache.wicket.markup.html.form.TextField;
import org.apache.wicket.markup.html.panel.FeedbackPanel;
import org.apache.wicket.model.CompoundPropertyModel;
import tw.com.slsinfo.commons.wicket.components.blockui.AjaxSubmitLinkBlockUI;
import tw.com.slsinfo.commons.wicket.modal.BaseModal;
import tw.com.slsinfo.essayai.controls.GenreDropDownChoice;
import tw.com.slsinfo.essayai.databases.mysql.entities.Genre;
import tw.com.slsinfo.essayai.models.course.EssayViewModel;

import java.util.Set;

public class CreateEssayModal extends BaseModal<EssayViewModel> {
    private static final Logger logger = LogManager.getLogger(CreateEssayModal.class);

    private StatelessForm<EssayViewModel> formModal;

    private EssayViewModel model;

    private TextField<String> title;
    private TextArea<String> supplementarytxt;
    private TextField<String> enable;
    private int eid;
    private Integer sid;
    private FeedbackPanel feedbackPanel;

    private transient Validator validator;

    public CreateEssayModal(String id, Integer sid) {
        super(id);
        this.sid = sid;
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        model = new EssayViewModel();
        formModal = new StatelessForm<>("formModal");
        feedbackPanel = new FeedbackPanel("feedbackPanel");
        feedbackPanel.setOutputMarkupId(true);
        title = new TextField<>("title");
        supplementarytxt = new TextArea<>("supplementarytxt");
        enable = new TextField<>("enable");

        //傳入sid
        DropDownChoice<Genre> genreDropDownChoice = new GenreDropDownChoice("genreobject", sid) {
            @Override
            protected void setDefault() {
            }
        };

        AjaxSubmitLink submit = new AjaxSubmitLinkBlockUI("submit", formModal) {
            @Override
            protected void onSubmit(AjaxRequestTarget target) {
                super.onSubmit(target);
                model.setEnable("1");
                model.setSid(sid);

                try {
                    Object modelObject = genreDropDownChoice.getModelObject();
                    Genre selectedGenre = (Genre) modelObject;  // 這裡加入明確的轉換

                    if (selectedGenre != null) {
                        Integer genreId = selectedGenre.getId();
                        model.setGid(genreId);
                    }
                } catch (ClassCastException e) {
                    error("型別轉換錯誤: " + e.getMessage());
                    target.add(feedbackPanel);
                    return;
                } catch (Exception e) {
                    error("其他錯誤: " + e.getMessage());
                    target.add(feedbackPanel);
                    return;
                }

                ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
                validator = factory.getValidator();
                Set<ConstraintViolation<EssayViewModel>> violations = validator.validate(model);

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

        formModal.add(title, genreDropDownChoice, supplementarytxt, enable);
        formModal.add(feedbackPanel, submit);
        formModal.setDefaultModel(new CompoundPropertyModel<>(model));
        formModal.setOutputMarkupId(true);
        add(formModal);
    }

    @Override
    public void setModelObject(EssayViewModel essayViewModel) {
        super.setModelObject(essayViewModel);
    }

    @Override
    public void show(IPartialPageRequestHandler partialPageRequestHandler) {
        partialPageRequestHandler.add(formModal);
        super.show(partialPageRequestHandler);
    }
}
