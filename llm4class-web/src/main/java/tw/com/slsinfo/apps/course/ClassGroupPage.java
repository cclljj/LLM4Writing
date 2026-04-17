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
import org.apache.wicket.markup.html.form.ChoiceRenderer;
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
import tw.com.slsinfo.essayai.controls.ClassnameDropDownChoice;
import tw.com.slsinfo.essayai.controls.EssayDropDownChoice;
import tw.com.slsinfo.essayai.controls.SelectOptionDropDownChoice;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.essayai.modals.MessageModal;
import tw.com.slsinfo.essayai.models.ConfirmModel;
import tw.com.slsinfo.essayai.models.SelectOption;
import tw.com.slsinfo.essayai.models.course.EssayViewModel;
import tw.com.slsinfo.essayai.models.course.OpenClassModel;
import tw.com.slsinfo.essayai.models.course.OpenClassesView;
import tw.com.slsinfo.essayai.services.*;
import tw.com.slsinfo.modal.course.CreateOpenclassModal;
import tw.com.slsinfo.modal.course.GroupManagementModal;
import tw.com.slsinfo.modal.course.ModifyOpenclassModal;
import tw.com.slsinfo.model.course.QueryModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;

@MountPath("/apps/classgroup")
public class ClassGroupPage extends BaseAppPage {
    private static final Logger logger = LogManager.getLogger(tw.com.slsinfo.apps.course.ClassGroupPage.class);

    private static final long serialVersionUID = 1L;

    private StatelessForm<QueryModel> queryForm;

    private QueryModel queryModel;

    private CreateOpenclassModal createOpenclassModal;
    private ModifyOpenclassModal modifyOpenclassModal;
    private GroupManagementModal groupManagementModal;

    private MessageModal messageModal;

    private WebMarkupContainer container;

    private UBoldPageNavigator pagingNavigator;

    private PageableListView<OpenClassesView> pageableListView;

    private FeedbackPanel feedbackPanel;
    private DropDownChoice<EssayViewModel> essayDropDownChoice;
    private DropDownChoice<OpenClassesView> classnameDropDownChoice;
    private DropDownChoice<SelectOption> enableDropDownChoice;
    private User user;
    private School school;
    private String llmtype = "llm4class";
    // 狀態選項列表
    private static final List<SelectOption> STATUS_OPTIONS = Arrays.asList(
            new SelectOption("1", "啟用"),
            new SelectOption("0", "停用")
    );

    public ClassGroupPage() {
    }

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
        queryForm.add(classnameDropDownChoice, essayDropDownChoice, enableDropDownChoice, btnQuery);

        // 訊息模態框
        messageModal = new MessageModal("messageModal") {
            @Override
            protected void onResponse(ConfirmModel confirmModel, IPartialPageRequestHandler iPartialPageRequestHandler) {
                super.onResponse(confirmModel, iPartialPageRequestHandler);
                refreshPageContent(iPartialPageRequestHandler);
            }
        };

        //先傳入modal的下拉選單中需要的資料來源
        createOpenclassModal = new CreateOpenclassModal("createOpenclassModal", getWicketSession().getSid(), llmtype) {
            private static final long serialVersionUID = 1L;

            @Override
            protected void onResponse(OpenClassModel openClassModel, IPartialPageRequestHandler iPartialPageRequestHandler) {
                super.onResponse(openClassModel, iPartialPageRequestHandler);
                try {
                    openClassModel.setSid(school);
                    openClassModel.setCreateduid(user.getId());
                    openClassModel.setLlmtype(llmtype);
                    CDI.current().select(OpenclassService.class).get().createOpenclass(openClassModel, user);
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
                createOpenclassModal.setModelObject(new OpenClassModel());
                createOpenclassModal.show(target);
            }
        };

        container = new WebMarkupContainer("container");
        container.setOutputMarkupId(true);

        modifyOpenclassModal = new ModifyOpenclassModal("modifyOpenclassModal", getWicketSession().getSid(), llmtype) {
            private static final long serialVersionUID = 1L;

            @Override
            protected void onResponse(OpenClassesView openClassesView, IPartialPageRequestHandler iPartialPageRequestHandler) {
//                try (CloseableThreadContext.Instance ignore =
//                             CloseableThreadContext.putAll(WebUtils.getMGMLogModelMap(getWicketSession().getUID(), EventType.MODIFY, WicketUtils.getClientIP(this), getWicketSession().getSchoolid()))) {
                super.onResponse(openClassesView, iPartialPageRequestHandler);
                CDI.current().select(OpenclassService.class).get().updateOpenclass(openClassesView, user);
                // 修改成功後重新整理頁面內容和下拉選單
                refreshPageContent(iPartialPageRequestHandler);
            }
        };

        groupManagementModal = new GroupManagementModal("groupManagementModal", getWicketSession().getSid(), llmtype) {
            private static final long serialVersionUID = 1L;

            @Override
            protected void onResponse(OpenClassesView openClassesView, IPartialPageRequestHandler iPartialPageRequestHandler) {
                super.onResponse(openClassesView, iPartialPageRequestHandler);
                messageModal.setMessage(Model.of("分組設定完成"));
                messageModal.show(iPartialPageRequestHandler);

                // 重新整理頁面內容
                refreshPageContent(iPartialPageRequestHandler);
            }
        };

        List<OpenClassesView> initialResults = getOpenClassesView(queryModel, llmtype);
        pageableListView = new PropertyPageableListView<OpenClassesView>("data", initialResults, 50) {
            @Override
            protected void populateItem(ListItem<OpenClassesView> item) {

                OpenClassesView p = item.getModelObject();
                Label serial = new Label("serial", item.getIndex() + 1);
                Label classname = new Label("classname", p.getClassname());
                Label essay_title = new Label("essay_title", p.getTitle());
                Label essay_genre = new Label("essay_genre", p.getGenre());
                Label discussion_time = new Label("discussion_time", p.getDiscussiontime());
                Label enable = new Label("enable", Objects.equals(p.getEnable(), "1") ? "啟用" : "停用");

                AjaxLink<Void> btnModified = new AjaxLink<Void>("btnModified") {
                    private static final long serialVersionUID = 1L;

                    @Override
                    public void onClick(AjaxRequestTarget target) {
                        modifyOpenclassModal.setModelObject(p);
                        modifyOpenclassModal.show(target);
                    }
                };

                AjaxLink<Void> btnNext = new AjaxLink<Void>("btnNext") {
                    private static final long serialVersionUID = 1L;

                    @Override
                    public void onClick(AjaxRequestTarget target) {
                        // 建立頁面參數
                        PageParameters parameters = new PageParameters();
                        parameters.add("ocid", p.getId());
                        // 導向到 GroupManagePage
                        setResponsePage(GroupManagePage.class, parameters);
                        logger.debug("成功導向分組管理頁面，開課ID: {}", p.getId());
                    }
                };

                // 在 ClassGroupPage.java 中的修正部分

                AjaxLink<Void> btnGroup = new AjaxLink<Void>("btnGroup") {
                    private static final long serialVersionUID = 1L;

                    @Override
                    public void onClick(AjaxRequestTarget target) {
                        try {
                            logger.debug("準備開啟分組管理 - 開課ID: {}", p.getId());

                            // 檢查是否已有分組資料
                            boolean hasGroups = CDI.current().select(ClassGroupService.class).get()
                                    .hasExistingGroups(p.getId());

                            if (hasGroups) {
                                logger.debug("開課 {} 已有分組資料，載入現有分組", p.getId());
                            } else {
                                logger.debug("開課 {} 尚無分組資料，建立新分組", p.getId());
                            }

                            // 重要修正：先設定模型對象，再顯示Modal
                            groupManagementModal.setModelObject(p);
                            groupManagementModal.show(target);

                        } catch (Exception e) {
                            logger.debug("開啟分組管理失敗", e);
                            messageModal.setMessage(Model.of("開啟分組管理失敗：" + e.getMessage()));
                            messageModal.show(target);
                        }
                    }
                };

                AjaxLink<Void> btnDelete = new AjaxLink<Void>("btnDelete") {
                    private static final long serialVersionUID = 1L;

                    @Override
                    public void onClick(AjaxRequestTarget target) {
                        try {
                            CDI.current().select(OpenclassService.class).get().deleteOpenclass(p);
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
                item.add(serial, classname, essay_title, enable, essay_genre, discussion_time, btnDelete, btnGroup, btnModified, btnNext);
            }
        };

        pageableListView.setOutputMarkupId(true);
        pagingNavigator = new AjaxUBoldPageNavigator("pagingNavigator", pageableListView);
        pagingNavigator.setOutputMarkupId(true);
        container.add(btnAdd, pageableListView, pagingNavigator);
        add(queryForm, feedbackPanel, container, createOpenclassModal, modifyOpenclassModal, groupManagementModal, messageModal);
    }

    /**
     * 初始化下拉選單
     */
    private void initializeDropdowns() {
        essayDropDownChoice = new EssayDropDownChoice("essay", false, getWicketSession().getSid(), llmtype) {
            @Override
            protected void setDefault() {
                // 可以在這裡設定預設值
            }

            @Override
            protected CharSequence getDefaultChoice(String selectedValue) {
                return "<option value=\"\">全部</option>";
            }
        };
        essayDropDownChoice.setOutputMarkupId(true);
        essayDropDownChoice.setNullValid(true); // 允許空白選項
        essayDropDownChoice.setChoiceRenderer(new ChoiceRenderer<EssayViewModel>() {
            @Override
            public Object getDisplayValue(EssayViewModel object) {
                return object != null ? object.getTitle() : "";
            }
        });

        classnameDropDownChoice = new ClassnameDropDownChoice("classname", false, getWicketSession().getSid(), llmtype) {
            @Override
            protected CharSequence getDefaultChoice(String selectedValue) {
                return "<option value=\"\">全部</option>";
            }
        };
        classnameDropDownChoice.setOutputMarkupId(true);
        classnameDropDownChoice.setNullValid(true); // 允許空白選項

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
            // 保存目前選擇的值
            EssayViewModel selectedEssay = queryModel.getEssay();
            OpenClassesView selectedClassname = queryModel.getClassname();

            // 重新載入下拉選單資料
//            refreshDropdowns();
            initializeDropdowns();

            // 恢復原先選擇的值
            queryModel.setEssay(selectedEssay);
            queryModel.setClassname(selectedClassname);

            // 重新載入資料列表
            List<OpenClassesView> results = getOpenClassesView(queryModel, llmtype);
            pageableListView.setDefaultModel(Model.ofList(results));

            // 更新前端元件
            target.add(queryForm, container, feedbackPanel);
        } catch (Exception e) {
            logger.debug("重新整理頁面內容失敗", e);
        }
    }

    /**
     * 重新整理下拉選單資料
     */
    private void refreshDropdowns() {
        try {
            // 重新載入論文下拉選單資料，保持空白選項
            List<EssayViewModel> essayList = CDI.current().select(EssayService.class).get().getAllEssay(getWicketSession().getSid(), llmtype);
            essayDropDownChoice.setChoices(essayList);
            // 確保空白選項可用
            essayDropDownChoice.setNullValid(true);

            // 設定顯示格式
            essayDropDownChoice.setChoiceRenderer(new ChoiceRenderer<EssayViewModel>() {
                @Override
                public Object getDisplayValue(EssayViewModel object) {
                    return object != null ? object.getTitle() : "";
                }

                @Override
                public String getIdValue(EssayViewModel object, int index) {
                    return object != null ? String.valueOf(object.getId()) : "";
                }
            });
            // 重新載入班級下拉選單資料（如果有自訂的更新邏輯）
            // 確保班級下拉選單也保持空白選項
            classnameDropDownChoice = new ClassnameDropDownChoice("classname", false, getWicketSession().getSid(), llmtype) {
                @Override
                protected CharSequence getDefaultChoice(String selectedValue) {
                    return "<option value=\"\">全部</option>";
                }
            };
            classnameDropDownChoice.setNullValid(true);
        } catch (Exception e) {
            logger.debug("重新整理下拉選單失敗", e);
        }
    }

    public List<OpenClassesView> getOpenClassesView(QueryModel queryModel, String llmtype) {
        try {
            EssayViewModel e = queryModel.getEssay();
            String classname = queryModel.getClassname() == null ? null : queryModel.getClassname().getClassname();
            Integer essayid = queryModel.getEssay() == null ? null : queryModel.getEssay().getId();
            String enable = queryModel.getEnable() == null ? null : queryModel.getEnable().getValue();
            return CDI.current().select(OpenclassService.class).get().getOpenClasses(getWicketSession().getSid(), enable, classname, essayid, llmtype);
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

        List<OpenClassesView> results = getOpenClassesView(queryModel, llmtype);
        logger.debug("查詢結果數量: {}", results.size());
        pageableListView.setDefaultModel(Model.ofList(results));
        target.add(container, feedbackPanel);
    }

}
