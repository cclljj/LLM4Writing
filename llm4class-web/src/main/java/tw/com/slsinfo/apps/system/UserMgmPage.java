package tw.com.slsinfo.apps.system;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.core.request.handler.IPartialPageRequestHandler;
import org.apache.wicket.markup.html.WebMarkupContainer;
import org.apache.wicket.markup.html.basic.Label;
import org.apache.wicket.markup.html.list.ListItem;
import org.apache.wicket.markup.html.list.PageableListView;
import org.apache.wicket.model.Model;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;
import tw.com.slsinfo.commons.crypto.messagedigest.MDUtils;
import tw.com.slsinfo.commons.wicket.navigator.AjaxUBoldPageNavigator;
import tw.com.slsinfo.commons.wicket.navigator.PropertyPageableListView;
import tw.com.slsinfo.commons.wicket.navigator.UBoldPageNavigator;
import tw.com.slsinfo.essayai.databases.mysql.entities.Roleuser;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.essayai.models.ILLMUserRoles;
import tw.com.slsinfo.essayai.models.system.ResetPwdModel;
import tw.com.slsinfo.essayai.services.RoleUserService;
import tw.com.slsinfo.essayai.services.UserAccountService;
import tw.com.slsinfo.modal.system.ResetPwdModal;

import java.util.ArrayList;
import java.util.List;

@MountPath("/apps/usersmgm")
public class UserMgmPage extends BaseAppPage {
    private static final Logger logger = LoggerFactory.getLogger(UserMgmPage.class);
    private final List<Roleuser> roleUserList = new ArrayList<>();

    private final UserAccountService userAccountService = CDI.current().select(UserAccountService.class).get();
    private final RoleUserService roleUserService = CDI.current().select(RoleUserService.class).get();

    public UserMgmPage() {
        WebMarkupContainer container = new WebMarkupContainer("container");
        container.setOutputMarkupId(true);

        //變更密碼
        ResetPwdModal resetPwdModal = new ResetPwdModal("resetPwdModal") {
            @Override
            protected void onResponse(ResetPwdModel resetPwdModel, IPartialPageRequestHandler iPartialPageRequestHandler) {
                super.onResponse(resetPwdModel, iPartialPageRequestHandler);

                User user = userAccountService.getUser(resetPwdModel.getUid());

                if(ObjectUtils.isNotEmpty(user)) {
                    user.setPassword(MDUtils.getSHA256Hex(resetPwdModel.getNewPassword()).get());
                    userAccountService.updateUser(user);
                    logger.debug("{} - update [{}] pwd success", user.getUid(), resetPwdModel.getUid());
                    iPartialPageRequestHandler.appendJavaScript("alert('密碼變更成功！');");
                } else {
                    iPartialPageRequestHandler.appendJavaScript("alert('密碼變更失敗，帳號不存在！');");
                }

                roleUserList.clear();
                roleUserList.addAll(roleUserService.getRoleUser());

                iPartialPageRequestHandler.add(container);
            }
        };

        PageableListView<Roleuser> pageableListView = new PropertyPageableListView<>("data", roleUserList, 10) {
            @Override
            protected void populateItem(ListItem<Roleuser> listItem) {
                Roleuser roleUser = listItem.getModelObject();

                Label no = new Label("no", listItem.getIndex() + 1);
                Label account = new Label("account", roleUser.getUid().getUid());
                Label name = new Label("name", roleUser.getUid().getName());
                Label school = new Label("school", roleUser.getSid().getFname());
                Label role = new Label("role", roleUser.getRid().getName());

                AjaxLink<Void> btnResetPwd = new AjaxLink<>("btnResetPwd") {
                    @Override
                    public void onClick(AjaxRequestTarget ajaxRequestTarget) {
                        ResetPwdModel model = new ResetPwdModel();
                        model.setUid(roleUser.getUid().getUid());
                        resetPwdModal.setModelObject(model);
                        resetPwdModal.show(ajaxRequestTarget);
                    }
                };

                listItem.add(no).add(account).add(name).add(school).add(role).add(btnResetPwd);
            }
        };
        pageableListView.setOutputMarkupId(true);
        pageableListView.setDefaultModel(Model.ofList(roleUserList));

        UBoldPageNavigator pagingNavigator = new AjaxUBoldPageNavigator("pagingNavigator", pageableListView);
        pagingNavigator.setOutputMarkupId(true);

        add(container).add(resetPwdModal);
        container.add(pageableListView).add(pagingNavigator);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();

        roleUserList.clear();

        if (getWicketSession().getRoleUsers().contains(ILLMUserRoles.TEACHER_ROLE)) {
            roleUserList.addAll(roleUserService.getRoleUserByRidSid(roleUserService.getStudentRoleName(), getWicketSession().getSchoolid()));
        } else {
            roleUserList.addAll(roleUserService.getRoleUser());
        }
    }
}
