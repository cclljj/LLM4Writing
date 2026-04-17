package tw.com.slsinfo.panel;

import org.apache.logging.log4j.CloseableThreadContext;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.form.AjaxSubmitLink;
import org.apache.wicket.markup.ComponentTag;
import org.apache.wicket.markup.html.form.*;
import org.apache.wicket.markup.html.panel.FeedbackPanel;
import org.apache.wicket.model.CompoundPropertyModel;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.Model;
import tw.com.slsinfo.HomePage;
import tw.com.slsinfo.WicketSession;
import tw.com.slsinfo.apps.stlearning.ActivityPage;
import tw.com.slsinfo.basic.BasePanel;
import tw.com.slsinfo.commons.model.IBuiltUserRoles;
import tw.com.slsinfo.commons.wicket.WicketUtils;
import tw.com.slsinfo.commons.wicket.components.blockui.AjaxSubmitLinkBlockUI;
import tw.com.slsinfo.commons.wicket.panel.CaptchaPanel;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;
import tw.com.slsinfo.essayai.models.wicket.SignInModel;
import tw.com.slsinfo.essayai.utils.WebUtils;

import java.io.Serial;
import java.util.UUID;


public class SignInPanel extends BasePanel {

    @Serial
    private static final long serialVersionUID = 1L;

    private static final Logger logger = LogManager.getLogger(SignInPanel.class);

    private SignInModel signInModel;
    private StatelessForm<SignInModel> formSignIn;
    private TextField<String> username;
    private TextField<String> password;
    private TextField<String> captcha;
    private AjaxSubmitLink doLogin;
    private HiddenField<String> anticsrf;
    private FeedbackPanel feedbackPanel;

    public SignInPanel(String id) {
        super(id);
    }

    public SignInPanel(String id, IModel<?> model) {
        super(id, model);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        feedbackPanel = new FeedbackPanel("feedback");
        feedbackPanel.setOutputMarkupId(true);
        formSignIn = new StatelessForm<>("formSignIn");
        signInModel = new SignInModel();
        formSignIn.setDefaultModel(new CompoundPropertyModel<>(signInModel));
        formSignIn.setDefaultButton(doLogin);
        username = new RequiredTextField<>("username");
        password = new PasswordTextField("password");
        captcha = new RequiredTextField<>("captcha") {
            @Override
            protected void onComponentTag(ComponentTag tag) {
                super.onComponentTag(tag);
                tag.put("value", "");
            }
        };
        password.setRequired(true);
        String uuid = UUID.randomUUID().toString();
        logger.debug("uuid:{}", uuid);
        signInModel.setUuid(uuid);
        anticsrf = new HiddenField<>("anticsrf") {
            @Override
            protected void onComponentTag(ComponentTag tag) {
                super.onComponentTag(tag);
                tag.put("value", uuid);
            }
        };
        anticsrf.setOutputMarkupId(true);
        final CaptchaPanel captchaPanel = new CaptchaPanel("captchaPanel", Model.of(3));
        captchaPanel.setOutputMarkupId(true);
        formSignIn.add(username).add(password).add(captcha).add(anticsrf).add(captchaPanel);
        formSignIn.setOutputMarkupId(true);

        doLogin = new AjaxSubmitLinkBlockUI("doLogin", formSignIn) {
            @Serial
            private static final long serialVersionUID = 1L;

            @Override
            protected void onSubmit(AjaxRequestTarget target) {
                super.onSubmit(target);

                boolean isMatch = captchaPanel.getRandomString().equals(signInModel.getCaptcha());
                logger.debug("AntiCSRF form : {} isMatch={}", signInModel.getAnticsrf(), signInModel.getAnticsrf().equals(uuid));

                if (isMatch) {

                    boolean authenticated = ((WicketSession) getWebSession()).signIn(
                            signInModel.getUsername(), signInModel.getPassword());

                    try (final CloseableThreadContext.Instance instance =
                                 CloseableThreadContext.putAll(
                                         WebUtils.getLLMWritingLogModelMap(getWicketSession().getUsername(), EventType.LOGIN, WicketUtils.getClientHost(this), getWicketSession().getSchoolid()))) {

                        if (authenticated) {
                            logger.debug("{} Login SUCCESS", signInModel.getUsername());
                            continueToOriginalDestination();
                            if (getWicketSession().getRoles().contains(IBuiltUserRoles.STUDENT)) {
                                setResponsePage(ActivityPage.class);
                            } else {
                                setResponsePage(HomePage.class);
                            }
                        } else {
                            error("帳號或密碼錯誤");
                        }
                        captchaPanel.refreshCaptcha();
                        signInModel.setCaptcha(UUID.randomUUID().toString());
                        target.add(feedbackPanel);
                    }
                } else {
                    error("驗證碼錯誤，請重新輸入");
                    signInModel.setCaptcha(UUID.randomUUID().toString());
                    captchaPanel.refreshCaptcha();
                }
                target.add(captchaPanel, formSignIn, feedbackPanel);
            }

            @Override
            protected void onError(AjaxRequestTarget target) {
                super.onError(target);
                logger.debug("Sign In Form Error");
                captchaPanel.refreshCaptcha();
                target.add(captchaPanel, feedbackPanel);
            }

            @Override
            protected boolean getStatelessHint() {
                return true;
            }
        };


        add(formSignIn).add(doLogin).add(feedbackPanel);
    }
}
