package tw.com.slsinfo.modal.course;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.AttributeModifier;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.ajax.markup.html.form.AjaxButton;
import org.apache.wicket.markup.html.form.Form;
import org.apache.wicket.markup.html.form.TextField;
import org.apache.wicket.markup.html.panel.FeedbackPanel;
import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.CompoundPropertyModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroup;
import tw.com.slsinfo.essayai.services.GroupManageService;

public abstract class CreateGroupPanel extends Panel {
    private static final long serialVersionUID = 1L;
    private static final Logger logger = LogManager.getLogger(CreateGroupPanel.class);

//    @Inject
//    private GroupManageService groupManageService;
    private FeedbackPanel feedbackPanel;
    private Integer ocid;

    public CreateGroupPanel(String id, Integer ocid) {
        super(id);
        this.ocid = ocid;
        initComponents();
    }

    private void initComponents() {
        // 建立回饋面板
        feedbackPanel = new FeedbackPanel("feedbackPanel");
        feedbackPanel.setOutputMarkupId(true);

        // 建立表單
        Classgroup newGroup = new Classgroup();
        Form<Classgroup> form = new Form<>("form", new CompoundPropertyModel<>(newGroup));
        form.setOutputMarkupId(true);
        add(form);

        // 組別名稱輸入框
        TextField<String> groupNameField = new TextField<>("groupname");
        groupNameField.setRequired(true);
        groupNameField.add(new AttributeModifier("placeholder", "請輸入組別名稱"));
        groupNameField.add(new AttributeModifier("maxlength", "50"));
        form.add(groupNameField);

        // 提交按鈕
        AjaxButton submitButton = new AjaxButton("submit", form) {
            @Override
            protected void onSubmit(AjaxRequestTarget target) {
                try {
                    String groupName = newGroup.getGroupname();
                    if (groupName == null || groupName.trim().isEmpty()) {
                        error("請輸入組別名稱");
                        target.add(feedbackPanel);
                        return;
                    }

                    if ( ocid != null) {
                        CDI.current().select(GroupManageService.class).get().createGroup(ocid, groupName.trim());
                        success("組別建立成功！");
                        logger.debug("成功建立組別：{}", groupName.trim());

                        // 清空表單
                        newGroup.setGroupname("");
                        target.add(form);

                        // 調用成功回調
                        onGroupCreated(target);
                    } else {
                        String errorMsg = "服務未初始化或缺少必要參數";
                        error(errorMsg);
                        logger.debug("{} - ocid: {}", errorMsg, ocid);
                        target.add(feedbackPanel);
                    }
                } catch (Exception e) {
                    String errorMsg = "建立組別失敗：" + e.getMessage();
                    logger.debug("建立組別時發生錯誤", e);
                    error(errorMsg);
                    target.add(feedbackPanel);
                    target.appendJavaScript("if (typeof window.showErrorToast === 'function') { window.showErrorToast('建立組別失敗'); }");
                }
            }

            @Override
            protected void onError(AjaxRequestTarget target) {
                logger.warn("表單驗證失敗");
                target.add(feedbackPanel);
                target.appendJavaScript("if (typeof window.showErrorToast === 'function') { window.showErrorToast('請檢查輸入內容'); }");
            }
        };
        form.add(submitButton);
        form.add(feedbackPanel);

        // 取消按鈕
        AjaxLink<Void> cancelButton = new AjaxLink<Void>("cancelButton") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                logger.debug("使用者取消建立組別");
                // 清空表單
                newGroup.setGroupname("");
                target.add(form);
                onCancel(target);
            }
        };
        form.add(cancelButton);
    }

    /**
     * 當組別成功建立時調用
     *
     * @param target AJAX 目標
     */
    protected abstract void onGroupCreated(AjaxRequestTarget target);

    /**
     * 當使用者取消操作時調用
     *
     * @param target AJAX 目標
     */
    protected abstract void onCancel(AjaxRequestTarget target);
}