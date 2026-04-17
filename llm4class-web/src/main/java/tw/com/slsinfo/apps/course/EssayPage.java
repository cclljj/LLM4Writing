package tw.com.slsinfo.apps.course;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.ajax.markup.html.form.AjaxSubmitLink;
import org.apache.wicket.core.request.handler.IPartialPageRequestHandler;
import org.apache.wicket.markup.html.WebMarkupContainer;
import org.apache.wicket.markup.html.basic.Label;
import org.apache.wicket.markup.html.form.DropDownChoice;
import org.apache.wicket.markup.html.form.StatelessForm;
import org.apache.wicket.markup.html.list.ListItem;
import org.apache.wicket.markup.html.list.PageableListView;
import org.apache.wicket.markup.html.panel.FeedbackPanel;
import org.apache.wicket.model.CompoundPropertyModel;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.Model;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;
import tw.com.slsinfo.commons.wicket.components.blockui.AjaxSubmitLinkBlockUI;
import tw.com.slsinfo.commons.wicket.navigator.AjaxUBoldPageNavigator;
import tw.com.slsinfo.commons.wicket.navigator.PropertyPageableListView;
import tw.com.slsinfo.commons.wicket.navigator.UBoldPageNavigator;
import tw.com.slsinfo.essayai.controls.SelectOptionDropDownChoice;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.essayai.modals.MessageModal;
import tw.com.slsinfo.essayai.models.ConfirmModel;
import tw.com.slsinfo.essayai.models.SelectOption;
import tw.com.slsinfo.essayai.models.course.EssayViewModel;
import tw.com.slsinfo.essayai.services.EssayService;
import tw.com.slsinfo.essayai.services.SchoolService;
import tw.com.slsinfo.essayai.services.UserAccountService;
import tw.com.slsinfo.modal.course.CreateEssayModal;
import tw.com.slsinfo.modal.course.ModifyEssayModal;
import tw.com.slsinfo.model.course.QueryModel;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

@MountPath("/apps/essay")
public class EssayPage extends BaseAppPage {
    private static final long serialVersionUID = 1L;
    private static final Logger logger = LogManager.getLogger(EssayPage.class);

    private StatelessForm<QueryModel> queryForm;

    private QueryModel queryModel;

    private CreateEssayModal createEssayModal;
    private ModifyEssayModal modifyEssayModal;

    private MessageModal messageModal;

    private WebMarkupContainer container;

    private UBoldPageNavigator pagingNavigator;

    private PageableListView<EssayViewModel> pageableListView;

    private FeedbackPanel feedbackPanel;
    private DropDownChoice<SelectOption> enableDropDownChoice;
    private User user;
    private School school;
    private String llmtype = "llm4class";
    // 狀態選項列表
    private static final List<SelectOption> STATUS_OPTIONS = Arrays.asList(
            new SelectOption("1", "啟用"),
            new SelectOption("0", "停用")
    );

    @Override
    protected void onInitialize() {
        super.onInitialize();
        user = CDI.current().select(UserAccountService.class).get().getUser(getWicketSession().getUid());
        school = CDI.current().select(SchoolService.class).get().getSchoolBySId(getWicketSession().getSid());

        queryModel = new QueryModel();
        queryModel.setSid(getWicketSession().getSid());

        queryForm = new StatelessForm<>("queryForm");
        queryForm.setOutputMarkupId(true);
        queryForm.setDefaultModel(new CompoundPropertyModel<>(queryModel));

        feedbackPanel = new FeedbackPanel("feedbackPanel");
        feedbackPanel.setOutputMarkupId(true);

        // 初始化下拉選單
        initializeDropdowns();

        // 查詢按鈕
        AjaxSubmitLink btnQuery = new AjaxSubmitLinkBlockUI("btnQuery", queryForm) {
            @Override
            protected void onSubmit(AjaxRequestTarget target) {
                super.onSubmit(target);
                performQuery(target);
            }

            @Override
            protected void onError(AjaxRequestTarget target) {
                super.onError(target);
                target.add(feedbackPanel);
            }
        };
        btnQuery.setOutputMarkupId(true);

        queryForm.setDefaultModel(new CompoundPropertyModel<>(queryModel));
        queryForm.add(enableDropDownChoice, btnQuery);

        // 訊息模態框
        messageModal = new MessageModal("messageModal") {
            @Override
            protected void onResponse(ConfirmModel confirmModel, IPartialPageRequestHandler iPartialPageRequestHandler) {
                super.onResponse(confirmModel, iPartialPageRequestHandler);
                refreshPageContent(iPartialPageRequestHandler);
            }
        };

        createEssayModal = new CreateEssayModal("createEssayModal", getWicketSession().getSid()) {
            private static final long serialVersionUID = 1L;

            @Override
            protected void onResponse(EssayViewModel essayViewModel, IPartialPageRequestHandler iPartialPageRequestHandler) {
                super.onResponse(essayViewModel, iPartialPageRequestHandler);
                try {
                    essayViewModel.setSid(school.getId());
                    essayViewModel.setLlmtype(llmtype);
                    CDI.current().select(EssayService.class).get().createEssay(essayViewModel, user);
                    messageModal.setMessage(Model.of("新增成功"));
                    messageModal.show(iPartialPageRequestHandler);

                    // 新增成功後重新整理頁面內容和下拉選單
                    refreshPageContent(iPartialPageRequestHandler);
                } catch (Exception e) {
                    messageModal.setMessage(Model.of("新增失敗：" + e.getMessage()));
                    messageModal.show(iPartialPageRequestHandler);
                }
            }
        };

        AjaxLink btnAdd = new AjaxLink<Void>("btnAdd") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                createEssayModal.setModelObject(new EssayViewModel());
                createEssayModal.show(target);
            }
        };

        container = new WebMarkupContainer("container");
        container.setOutputMarkupId(true);
        modifyEssayModal = new ModifyEssayModal("modifyEssayModal", getWicketSession().getSid()) {
            private static final long serialVersionUID = 1L;

            @Override
            protected void onResponse(EssayViewModel essayViewModel, IPartialPageRequestHandler iPartialPageRequestHandler) {
//                try (CloseableThreadContext.Instance ignore =
//                             CloseableThreadContext.putAll(WebUtils.getMGMLogModelMap(getWicketSession().getUID(), EventType.MODIFY, WicketUtils.getClientIP(this), getWicketSession().getSchoolid()))) {
                super.onResponse(essayViewModel, iPartialPageRequestHandler);
                CDI.current().select(EssayService.class).get().updateEssay(essayViewModel);
                // 修改成功後重新整理頁面內容和下拉選單
                refreshPageContent(iPartialPageRequestHandler);
            }
        };

        List<EssayViewModel> initialResults = getEssayViewModel(queryModel);
        pageableListView = new PropertyPageableListView<EssayViewModel>("data", initialResults, 50) {
            @Override
            protected void populateItem(ListItem<EssayViewModel> item) {

                EssayViewModel p = item.getModelObject();
                Label serial = new Label("serial", item.getIndex() + 1);
                Label essay_title = new Label("essay_title", p.getTitle());
                Label essay_genre = new Label("essay_genre", p.getGenre());
                Label enable = new Label("enable", Objects.equals(p.getEnable(), "1") ? "啟用" : "停用");

                AjaxLink<Void> btnModified = new AjaxLink<Void>("btnModified") {
                    private static final long serialVersionUID = 1L;

                    @Override
                    public void onClick(AjaxRequestTarget target) {
                        modifyEssayModal.setModelObject(p);
                        modifyEssayModal.show(target);
                    }
                };

                AjaxLink<Void> btnDelete = new AjaxLink<Void>("btnDelete") {
                    private static final long serialVersionUID = 1L;

                    @Override
                    public void onClick(AjaxRequestTarget target) {
                        try {
                            CDI.current().select(EssayService.class).get().deleteEssay(p);
                            messageModal.setMessage(Model.of("刪除成功"));
                            messageModal.show(target);

                            // 刪除成功後重新整理頁面內容和下拉選單
                            refreshPageContent(target);
                        } catch (Exception e) {
                            messageModal.setMessage(Model.of("刪除失敗：" + e.getMessage()));
                            messageModal.show(target);
                        }
                    }
                };
                item.add(serial, essay_title, enable, essay_genre, btnModified, btnDelete);
            }
        };

        pageableListView.setOutputMarkupId(true);
        pagingNavigator = new AjaxUBoldPageNavigator("pagingNavigator", pageableListView);
        pagingNavigator.setOutputMarkupId(true);
        container.add(btnAdd, pageableListView, pagingNavigator);
        add(queryForm, feedbackPanel, container, createEssayModal, modifyEssayModal, messageModal);
    }

    /**
     * 初始化下拉選單
     */
    private void initializeDropdowns() {
        enableDropDownChoice = new SelectOptionDropDownChoice(false, "enable", STATUS_OPTIONS) {
            @Override
            protected void setDefault() {
                // 可以在這裡設定預設值
            }

            @Override
            public SelectOption getObject(String id, IModel<? extends List<? extends SelectOption>> choices) {
                return null;
            }

            @Override
            protected CharSequence getDefaultChoice(String selectedValue) {
                return "<option value=\"\">全部</option>";
            }
        };
        enableDropDownChoice.setOutputMarkupId(true);
        enableDropDownChoice.setNullValid(true); // 允許空白選項
    }

    /**
     * 重新整理頁面內容，包含下拉選單和資料列表
     */
    private void refreshPageContent(IPartialPageRequestHandler target) {
        try {
            // 重新載入下拉選單資料
//            refreshDropdowns();
            initializeDropdowns();

            // 重新載入資料列表
            List<EssayViewModel> results = getEssayViewModel(queryModel);
            pageableListView.setDefaultModel(Model.ofList(results));

            // 更新前端元件
            target.add(queryForm, container, feedbackPanel);
        } catch (Exception e) {
            logger.debug("重新整理頁面內容失敗", e);
        }
    }

    public List<EssayViewModel> getEssayViewModel(QueryModel queryModel) {
        try {
            EssayViewModel e = queryModel.getEssay();
            Integer essayid = queryModel.getEssay() == null ? null : queryModel.getEssay().getId();
            String enable = queryModel.getEnable() == null ? null : queryModel.getEnable().getValue();
            return CDI.current().select(EssayService.class).get().getEssayView(enable, null, getWicketSession().getSid(), llmtype);
        } catch (Exception e) {
            logger.debug("查詢分組討論失敗{},{}", queryModel, e);
            return new ArrayList<>();
        }
    }

    /**
     * 執行查詢操作
     *
     * @param target AJAX 目標
     */
    private void performQuery(AjaxRequestTarget target) {
        SelectOption enableOption = queryModel.getEnable();

        logger.debug("=== 表單提交調試資訊 ===");
        logger.debug("queryModel.getEnable(): {}", enableOption);
        if (enableOption != null) {
            logger.debug("Enable - getValue(): {}", enableOption.getValue());
            logger.debug("Enable - getLabel(): {}", enableOption.getLabel());
            logger.debug("Enable - toString(): {}", enableOption.toString());
        }

        List<EssayViewModel> results = getEssayViewModel(queryModel);
        logger.debug("查詢結果數量: {}", results.size());
        pageableListView.setDefaultModel(Model.ofList(results));
        target.add(container, feedbackPanel);
    }

}
