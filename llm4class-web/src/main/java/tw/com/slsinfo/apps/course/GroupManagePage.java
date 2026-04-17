package tw.com.slsinfo.apps.course;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.AttributeModifier;
import org.apache.wicket.ajax.AbstractDefaultAjaxBehavior;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.attributes.AjaxRequestAttributes;
import org.apache.wicket.ajax.form.AjaxFormComponentUpdatingBehavior;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.markup.head.CssHeaderItem;
import org.apache.wicket.markup.head.IHeaderResponse;
import org.apache.wicket.markup.head.JavaScriptHeaderItem;
import org.apache.wicket.markup.head.OnDomReadyHeaderItem;
import org.apache.wicket.markup.html.WebMarkupContainer;
import org.apache.wicket.markup.html.basic.Label;
import org.apache.wicket.markup.html.form.DropDownChoice;
import org.apache.wicket.markup.html.form.Form;
import org.apache.wicket.markup.html.list.ListItem;
import org.apache.wicket.markup.html.list.ListView;
import org.apache.wicket.markup.html.panel.FeedbackPanel;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.LoadableDetachableModel;
import org.apache.wicket.model.PropertyModel;
import org.apache.wicket.request.IRequestParameters;
import org.apache.wicket.request.cycle.RequestCycle;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.apache.wicket.request.resource.JavaScriptResourceReference;
import org.apache.wicket.util.string.StringValue;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroup;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroupmember;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;
import tw.com.slsinfo.essayai.services.ClassInfoService;
import tw.com.slsinfo.essayai.services.GroupManageService;
import tw.com.slsinfo.modal.course.CreateGroupPanel;

import java.util.*;

@MountPath("/apps/groupmanage")
public class GroupManagePage extends BaseAppPage {
    private static final long serialVersionUID = 1L;
    private static final Logger logger = LogManager.getLogger(GroupManagePage.class);

    private GroupManageService groupManageService = CDI.current().select(GroupManageService.class).get();
    private ClassInfoService classInfoService = CDI.current().select(ClassInfoService.class).get();

    private WebMarkupContainer groupsContainer;
    private WebMarkupContainer unassignedContainer;
    private WebMarkupContainer createGroupModalContainer;
    private AbstractDefaultAjaxBehavior tempAssignBehavior;
    private AbstractDefaultAjaxBehavior batchSaveBehavior;

    private ListView<Classinfo> unassignedStudentsList;
    private ListView<Classgroup> groupsList;

    // 頁面參數
    private Integer schoolId = getWicketSession().getSid();
    private Integer ocid;
    private String selectedClassName = "";

    private FeedbackPanel feedbackPanel;

    // 暫存的分組變更，用於批次儲存
    private Map<Integer, Integer> tempGroupAssignments = new HashMap<>(); // studentId -> groupId
    private boolean hasUnsavedChanges = false;

    public GroupManagePage(PageParameters parameters) {
        super(parameters);

        // 從 URL 參數中獲取 ocid
        if (parameters.get("ocid") != null && !parameters.get("ocid").isEmpty()) {
            try {
                this.ocid = parameters.get("ocid").toInt();
                logger.debug("接收到開課ID: {}", this.ocid);
            } catch (Exception e) {
                logger.debug("無法解析開課ID參數", e);
                this.ocid = null;
            }
        }

        initComponents();
    }

    public GroupManagePage() {
        initComponents();
    }

    private void initComponents() {
        // 建立回饋面板
        feedbackPanel = new FeedbackPanel("feedbackPanel");
        feedbackPanel.setOutputMarkupId(true);
        add(feedbackPanel);

        // 檢查必要參數
        if (ocid == null) {
            logger.warn("ocid 參數為空，可能會影響功能運作");
        }

        // 暫時分組處理行為
        initTempAssignBehavior();

        // 初始化批次儲存處理器
        initBatchSaveBehavior();

        // 班級篩選下拉選單
        initClassFilter();

        // 未分配學生區域
        initUnassignedArea();

        // 組別容器
        initGroupsContainer();

        // 建立組別 Modal 容器
        initCreateGroupModal();

        // 功能按鈕
        initActionButtons();

        // 載入現有分組資料
        loadExistingGroupData();
    }

    private void initTempAssignBehavior() {
        tempAssignBehavior = new AbstractDefaultAjaxBehavior() {
            @Override
            protected void respond(AjaxRequestTarget target) {
                // 確保這是 AJAX 請求
                if (target == null) {
                    logger.debug("AjaxRequestTarget 為 null，這不是有效的 AJAX 請求");
                    return;
                }

                StringValue studentIdParam = RequestCycle.get().getRequest().getRequestParameters().getParameterValue("studentId");
                StringValue groupIdParam = RequestCycle.get().getRequest().getRequestParameters().getParameterValue("groupId");

                logger.debug("AJAX 暫時分組請求 - studentId: {}, groupId: {}", studentIdParam, groupIdParam);

                if (!studentIdParam.isEmpty()) {
                    Integer studentId = studentIdParam.toInteger();
                    Integer groupId = groupIdParam.isEmpty() ? null : groupIdParam.toInteger();

                    try {
                        // 僅在記憶體中處理暫存變更，避免任何 Session 操作
                        tempGroupAssignments.put(studentId, groupId);
                        hasUnsavedChanges = true;

                        logger.debug("暫存分組變更成功（僅記憶體）- 學生 {} 預計分配到組別 {}", studentId, groupId);

                        // 最小化的回應，不觸發任何模型重新載入或 Session 操作
                        target.appendJavaScript(
                                "console.log('暫存變更已記錄，學生ID: " + studentId + ", 組別ID: " + groupId + "'); " +
                                        "if (typeof window.showTempSuccessToast === 'function') { " +
                                        "  window.showTempSuccessToast('學生已暫時分配，請記得儲存變更'); " +
                                        "} " +
                                        "if (typeof window.updateSaveButtonState === 'function') { " +
                                        "  window.updateSaveButtonState(true); " +
                                        "} " +
                                        // 延遲重新初始化，避免在當前請求中執行
                                        "setTimeout(function() { " +
                                        "  if (typeof window.safeReinit === 'function') { " +
                                        "    window.safeReinit(); " +
                                        "  } " +
                                        "}, 100);"
                        );

                    } catch (Exception e) {
                        logger.debug("處理暫時分組請求時發生錯誤", e);
                        target.appendJavaScript(
                                "if (typeof window.showErrorToast === 'function') { " +
                                        "  window.showErrorToast('操作失敗：" + e.getMessage().replace("'", "\\'") + "'); " +
                                        "}"
                        );
                    }
                } else {
                    logger.debug("studentId 參數為空");
                    target.appendJavaScript(
                            "if (typeof window.showErrorToast === 'function') { " +
                                    "  window.showErrorToast('參數錯誤'); " +
                                    "}"
                    );
                }
            }

            @Override
            protected void updateAjaxAttributes(AjaxRequestAttributes attributes) {
                super.updateAjaxAttributes(attributes);
                // 設定較短的超時時間，並確保請求方式
                attributes.setMethod(AjaxRequestAttributes.Method.POST);
                attributes.getExtraParameters().put("timeout", "3000"); // 縮短至3秒

                // 重要：避免在 AJAX 請求中觸發 Session 寫入
                attributes.setPreventDefault(true);

                // 設定較低的請求優先級
                attributes.getExtraParameters().put("priority", "low");
            }
        };
        add(tempAssignBehavior);
    }

    private void initBatchSaveBehavior() {
        // 替代方案：使用單一 JSON 參數的方式
        batchSaveBehavior = new AbstractDefaultAjaxBehavior() {
            @Override
            protected void respond(AjaxRequestTarget target) {
                logger.debug("收到批次儲存請求");

                try {
                    IRequestParameters requestParams = RequestCycle.get().getRequest().getRequestParameters();

                    // 使用單一參數傳遞所有資料
                    StringValue assignmentsData = requestParams.getParameterValue("assignmentsData");

                    if (assignmentsData.isEmpty()) {
                        logger.warn("沒有接收到分配資料");
                        target.appendJavaScript(
                                "if (typeof window.showWarningToast === 'function') { " +
                                        "  window.showWarningToast('沒有需要儲存的變更'); " +
                                        "} " +
                                        "if (typeof window.hideLoadingIndicator === 'function') { " +
                                        "  window.hideLoadingIndicator(); " +
                                        "}"
                        );
                        return;
                    }

                    // 解析格式：studentId1:groupId1,studentId2:groupId2,studentId3:null
                    Map<Integer, Integer> assignments = parseAssignmentsData(assignmentsData.toString());

                    if (assignments.isEmpty()) {
                        logger.warn("解析後沒有有效的分配資料");
                        target.appendJavaScript(
                                "if (typeof window.showWarningToast === 'function') { " +
                                        "  window.showWarningToast('沒有需要儲存的變更'); " +
                                        "} " +
                                        "if (typeof window.hideLoadingIndicator === 'function') { " +
                                        "  window.hideLoadingIndicator(); " +
                                        "}"
                        );
                        return;
                    }

                    logger.debug("準備批次處理 {} 個分配", assignments.size());

                    // 調用 Service 進行批次處理
                    int successCount = groupManageService.batchAssignStudentsToGroups(assignments, ocid);

                    logger.debug("批次儲存完成 - 成功處理 {} 個分配", successCount);

                    // 清空暫存變更
                    tempGroupAssignments.clear();
                    hasUnsavedChanges = false;

                    // 回應成功
                    target.appendJavaScript(
                            "console.log('批次儲存成功，處理數量: " + successCount + "'); " +
                                    "if (typeof window.showSuccessToast === 'function') { " +
                                    "  window.showSuccessToast('分組儲存成功！共處理 " + successCount + " 個變更'); " +
                                    "} " +
                                    "if (typeof window.hideLoadingIndicator === 'function') { " +
                                    "  window.hideLoadingIndicator(); " +
                                    "}"
                    );

                    // 強制重新載入資料
                    detachComponentModels();
                    target.add(unassignedContainer);
                    target.add(groupsContainer);

                } catch (Exception e) {
                    logger.debug("批次儲存處理失敗", e);

                    String errorMessage = e.getMessage() != null ? e.getMessage() : "系統錯誤";
                    errorMessage = errorMessage.replace("'", "\\'").replace("\"", "\\\"");

                    target.appendJavaScript(
                            "console.error('批次儲存失敗: " + errorMessage + "'); " +
                                    "if (typeof window.showErrorToast === 'function') { " +
                                    "  window.showErrorToast('儲存失敗：" + errorMessage + "'); " +
                                    "} " +
                                    "if (typeof window.hideLoadingIndicator === 'function') { " +
                                    "  window.hideLoadingIndicator(); " +
                                    "}"
                    );
                }
            }

            // 解析分配資料的輔助方法
            private Map<Integer, Integer> parseAssignmentsData(String data) {
                Map<Integer, Integer> assignments = new HashMap<>();

                if (data == null || data.trim().isEmpty()) {
                    return assignments;
                }

                try {
                    // 分割格式：studentId1:groupId1,studentId2:groupId2,studentId3:null
                    String[] pairs = data.split(",");
                    for (String pair : pairs) {
                        String[] parts = pair.split(":");
                        if (parts.length == 2) {
                            Integer studentId = Integer.valueOf(parts[0].trim());
                            Integer groupId = null;

                            if (!"null".equals(parts[1].trim()) && !parts[1].trim().isEmpty()) {
                                groupId = Integer.valueOf(parts[1].trim());
                            }

                            assignments.put(studentId, groupId);
                            logger.debug("解析分配：學生 {} -> 組別 {}", studentId, groupId);
                        }
                    }
                } catch (Exception e) {
                    logger.debug("解析分配資料時發生錯誤：{}", data, e);
                }

                return assignments;
            }

            @Override
            protected void updateAjaxAttributes(AjaxRequestAttributes attributes) {
                super.updateAjaxAttributes(attributes);
                attributes.setMethod(AjaxRequestAttributes.Method.POST);
                attributes.getExtraParameters().put("timeout", "30000");
            }
        };
        add(batchSaveBehavior);
    }

    // 移除會觸發 Session 寫入的方法調用
    private void updateUIForTempAssignmentMinimal(AjaxRequestTarget target, Integer studentId, Integer groupId) {
        // 不要調用任何會觸發模型重新載入的方法
        // 不要調用 detachModels() 或 detachComponentModels()

        // 僅標記組件需要更新，但不強制重新載入模型
        target.add(unassignedContainer);
        target.add(groupsContainer);

        logger.debug("輕量級UI標記完成 - 學生 {} 暫時分配到組別 {}", studentId, groupId);
    }


    private void updateUIForTempAssignment(AjaxRequestTarget target, Integer studentId, Integer groupId) {
        // 手動觸發模型重新載入
        detachModels();

        // 添加到 AJAX 目標
        target.add(unassignedContainer);
        target.add(groupsContainer);
    }

    private void detachComponentModels() {
        try {
            // 分離未分配學生列表模型
            if (unassignedStudentsList != null && unassignedStudentsList.getDefaultModel() instanceof LoadableDetachableModel) {
                ((LoadableDetachableModel<?>) unassignedStudentsList.getDefaultModel()).detach();
                logger.debug("已分離未分配學生 ListView 模型");
            }

            // 分離組別列表模型
            if (groupsList != null && groupsList.getDefaultModel() instanceof LoadableDetachableModel) {
                ((LoadableDetachableModel<?>) groupsList.getDefaultModel()).detach();
                logger.debug("已分離組別 ListView 模型");
            }

            // 分離所有巢狀的成員列表模型
            groupsContainer.visitChildren(ListView.class, (component, visit) -> {
                if (component instanceof ListView) {
                    ListView<?> listView = (ListView<?>) component;
                    if (listView.getDefaultModel() instanceof LoadableDetachableModel) {
                        ((LoadableDetachableModel<?>) listView.getDefaultModel()).detach();
                        logger.debug("已分離巢狀 ListView 模型: {}", listView.getId());
                    }
                }
            });

        } catch (Exception e) {
            logger.debug("分離模型時發生錯誤", e);
        }
    }

    private void initClassFilter() {
        Form<Void> filterForm = new Form<>("filterForm");
        add(filterForm);

        IModel<List<String>> classNamesModel = new LoadableDetachableModel<List<String>>() {
            @Override
            protected List<String> load() {
                List<String> classes = new ArrayList<>();
                classes.add("");
                try {
                    classes.addAll(groupManageService.getAllClassNames(schoolId));
                } catch (Exception e) {
                    logger.debug("載入班級列表時發生錯誤", e);
                }
                return classes;
            }
        };

        DropDownChoice<String> classFilter = new DropDownChoice<String>("classFilter",
                new PropertyModel<>(this, "selectedClassName"), classNamesModel) {
            @Override
            protected String getDefaultChoice(String selected) {
                return "全部班級";
            }
        };

        classFilter.add(new AjaxFormComponentUpdatingBehavior("change") {
            @Override
            protected void onUpdate(AjaxRequestTarget target) {
                // 清空暫存的分組變更
                tempGroupAssignments.clear();
                hasUnsavedChanges = false;

                // 強制重新載入資料
                detachComponentModels();
                target.add(unassignedContainer);
                target.add(groupsContainer);

                // 重新初始化拖拽功能和更新按鈕狀態
                target.appendJavaScript(
                        "setTimeout(function() { " +
                                "if (typeof window.safeReinit === 'function') { window.safeReinit(); } " +
                                "if (typeof window.updateSaveButtonState === 'function') { window.updateSaveButtonState(false); } " +
                                "}, 100);"
                );
            }
        });

        filterForm.add(classFilter);
    }
    private void initUnassignedArea() {
        unassignedContainer = new WebMarkupContainer("unassignedContainer");
        unassignedContainer.setOutputMarkupId(true);
        unassignedContainer.add(new AttributeModifier("data-group-id", ""));
        unassignedContainer.add(new AttributeModifier("class", "unassigned-area ui-droppable"));
        add(unassignedContainer);

        unassignedStudentsList = new ListView<Classinfo>("unassignedStudents",
                new LoadableDetachableModel<List<Classinfo>>() {
                    @Override
                    protected List<Classinfo> load() {
                        try {
                            logger.debug("載入未分配學生 - selectedClassName: {}, ocid: {}", selectedClassName, ocid);

                            // 使用本地變數避免 Session 依賴
                            List<Classinfo> students = groupManageService.getUnassignedStudents(schoolId, selectedClassName, ocid);
                            List<Classinfo> filteredStudents = new ArrayList<>();

                            if (students != null) {
                                // 建立暫存變更的本地副本，避免直接存取實例變數
                                Map<Integer, Integer> tempAssignments = new HashMap<>(tempGroupAssignments);

                                for (Classinfo student : students) {
                                    Integer tempGroupId = tempAssignments.get(student.getId());
                                    if (tempGroupId == null) {
                                        filteredStudents.add(student);
                                    }
                                }

                                // 處理分配到未分配區域的學生
                                for (Map.Entry<Integer, Integer> entry : tempAssignments.entrySet()) {
                                    if (entry.getValue() == null) {
                                        Classinfo tempStudent = findStudentById(entry.getKey());
                                        if (tempStudent != null) {
                                            filteredStudents.add(tempStudent);
                                        }
                                    }
                                }
                            }

                            logger.debug("載入了 {} 名未分配學生（含暫存變更）", filteredStudents.size());
                            return filteredStudents;
                        } catch (Exception e) {
                            logger.debug("載入未分配學生資料時發生錯誤", e);
                            return new ArrayList<>();
                        }
                    }

                    @Override
                    public void detach() {
                        // 不調用 super.detach()，避免觸發 Session 寫入
                        logger.debug("未分配學生模型分離（輕量級）");
                    }
                }) {

            @Override
            protected void populateItem(ListItem<Classinfo> item) {
                try {
                    Classinfo student = item.getModelObject();
                    if (student != null && student.getUid() != null && student.getId() != null) {
                        Label nameLabel = new Label("studentName", student.getUid().getName());
                        nameLabel.setOutputMarkupId(true);
                        item.add(nameLabel);

                        Label classLabel = new Label("studentClass", student.getClassname() != null ? student.getClassname() : "");
                        item.add(classLabel);

                        String cssClass = "student-item ui-draggable ui-draggable-handle";
                        if (tempGroupAssignments.containsKey(student.getId())) {
                            cssClass += " temp-changed";
                        }

                        item.add(new AttributeModifier("class", cssClass));
                        item.add(new AttributeModifier("data-student-id", student.getId().toString()));
                        item.setOutputMarkupId(true);

                        logger.debug("設置未分配學生項目 - ID: {}, Name: {}", student.getId(), student.getUid().getName());
                    } else {
                        logger.warn("學生資料不完整");
                        item.add(new Label("studentName", "未知學生"));
                        item.add(new Label("studentClass", ""));
                        item.add(new AttributeModifier("class", "student-item"));
                        item.add(new AttributeModifier("data-student-id", ""));
                        item.setOutputMarkupId(true);
                    }
                } catch (Exception e) {
                    logger.debug("渲染學生項目時發生錯誤", e);
                    item.add(new Label("studentName", "載入錯誤"));
                    item.add(new Label("studentClass", ""));
                    item.add(new AttributeModifier("class", "student-item"));
                    item.add(new AttributeModifier("data-student-id", ""));
                    item.setOutputMarkupId(true);
                }
            }
        };
        unassignedContainer.add(unassignedStudentsList);

        WebMarkupContainer emptyUnassignedMessage = new WebMarkupContainer("emptyUnassignedMessage") {
            @Override
            protected void onConfigure() {
                super.onConfigure();
                try {
                    List<Classinfo> students = groupManageService.getUnassignedStudents(schoolId, selectedClassName, ocid);
                    // 考慮暫存變更
                    boolean isEmpty = (students == null || students.isEmpty()) &&
                            tempGroupAssignments.values().stream().noneMatch(groupId -> groupId == null);
                    setVisible(isEmpty);
                } catch (Exception e) {
                    logger.debug("配置空狀態訊息時發生錯誤", e);
                    setVisible(true);
                }
            }
        };
        unassignedContainer.add(emptyUnassignedMessage);
    }

    private Classinfo findStudentById(Integer studentId) {
        try {

            // 這裡需要實作根據ID查找學生的方法
            return classInfoService.getClassinfoViewByid(studentId);
        } catch (Exception e) {
            logger.debug("查找學生時發生錯誤", e);
            return null;
        }
    }

    private void initGroupsContainer() {
        groupsContainer = new WebMarkupContainer("groupsContainer");
        groupsContainer.setOutputMarkupId(true);
        add(groupsContainer);

        groupsList = new ListView<Classgroup>("groupsList",
                new LoadableDetachableModel<List<Classgroup>>() {
                    @Override
                    protected List<Classgroup> load() {
                        try {
                            logger.debug("載入組別資料 - ocid: {}", ocid);
                            List<Classgroup> groups = groupManageService.getGroupsByOcid(ocid);
                            logger.debug("載入了 {} 個組別", groups != null ? groups.size() : 0);
                            return groups != null ? groups : new ArrayList<>();
                        } catch (Exception e) {
                            logger.debug("載入組別資料時發生錯誤", e);
                            return new ArrayList<>();
                        }
                    }

                    @Override
                    public void detach() {
                        super.detach();
                        logger.debug("組別模型已分離");
                    }
                }) {
            @Override
            protected void populateItem(ListItem<Classgroup> item) {
                try {
                    Classgroup group = item.getModelObject();
                    if (group != null && group.getId() != null) {
                        item.add(new Label("groupName", group.getGroupname()));

                        item.add(new AttributeModifier("class", "group-container ui-droppable"));
                        item.add(new AttributeModifier("data-group-id", group.getId().toString()));

                        // 刪除按鈕
                        AjaxLink<Void> deleteLink = new AjaxLink<Void>("deleteGroup") {
                            @Override
                            public void onClick(AjaxRequestTarget target) {
                                try {
                                    groupManageService.deleteGroup(group.getId());

                                    // 清理暫存分組中與此組別相關的資料
                                    tempGroupAssignments.entrySet().removeIf(entry ->
                                            group.getId().equals(entry.getValue()));

                                    // 強制重新載入所有模型
                                    detachComponentModels();

                                    target.add(groupsContainer);
                                    target.add(unassignedContainer);
                                    target.appendJavaScript(
                                            "setTimeout(function() { " +
                                                    "if (typeof window.safeReinit === 'function') { window.safeReinit(); } " +
                                                    "if (typeof window.updateSaveButtonState === 'function') { " +
                                                    "window.updateSaveButtonState(" + hasUnsavedChanges + "); " +
                                                    "} " +
                                                    "}, 100);"
                                    );
                                    target.appendJavaScript("if (typeof window.showSuccessToast === 'function') { window.showSuccessToast('組別已刪除'); }");
                                } catch (Exception e) {
                                    logger.debug("刪除組別時發生錯誤", e);
                                    error("刪除組別失敗");
                                    target.add(feedbackPanel);
                                    target.appendJavaScript("if (typeof window.showErrorToast === 'function') { window.showErrorToast('刪除組別失敗'); }");
                                }
                            }
                        };
                        item.add(deleteLink);

                        // 成員列表（包含暫存變更）
                        ListView<Classgroupmember> membersList = new ListView<Classgroupmember>("membersList",
                                new LoadableDetachableModel<List<Classgroupmember>>() {
                                    @Override
                                    protected List<Classgroupmember> load() {
                                        try {
                                            logger.debug("載入組別 {} 的成員（含暫存變更）", group.getId());
                                            List<Classgroupmember> membersList = new ArrayList<>();

                                            // 先加入原有成員
                                            Set<Classgroupmember> originalMembers = group.getClassgroupmembers();
                                            if (originalMembers != null) {
                                                for (Classgroupmember member : originalMembers) {
                                                    // 檢查是否在暫存變更中被移除
                                                    Integer studentId = member.getMemberCid().getId();
                                                    Integer tempGroupId = tempGroupAssignments.get(studentId);
                                                    if (tempGroupId == null || tempGroupId.equals(group.getId())) {
                                                        membersList.add(member);
                                                    }
                                                }
                                            }

                                            // 加入暫存變更中分配到此組別的學生
                                            for (Map.Entry<Integer, Integer> entry : tempGroupAssignments.entrySet()) {
                                                if (group.getId().equals(entry.getValue())) {
                                                    Classinfo student = findStudentById(entry.getKey());
                                                    if (student != null) {
                                                        // 創建虛擬的組別成員對象
                                                        Classgroupmember tempMember = new Classgroupmember();
                                                        tempMember.setMemberCid(student);
                                                        tempMember.setCgid(group);
                                                        membersList.add(tempMember);
                                                    }
                                                }
                                            }

                                            logger.debug("組別 {} 有 {} 名成員（含暫存）", group.getId(), membersList.size());
                                            return membersList;
                                        } catch (Exception e) {
                                            logger.debug("載入組別成員資料時發生錯誤", e);
                                            return new ArrayList<>();
                                        }
                                    }

                                    @Override
                                    public void detach() {
                                        super.detach();
                                        logger.debug("組別 {} 成員模型已分離", group.getId());
                                    }
                                }) {
                            @Override
                            protected void populateItem(ListItem<Classgroupmember> memberItem) {
                                try {
                                    Classgroupmember member = memberItem.getModelObject();
                                    if (member != null && member.getMemberCid() != null) {
                                        Classinfo student = member.getMemberCid();

                                        String studentName = (student.getUid() != null) ? student.getUid().getName() : "未知學生";
                                        Label memberLabel = new Label("memberName", studentName);
                                        memberLabel.setOutputMarkupId(true);
                                        memberItem.add(memberLabel);

                                        Label memberClassLabel = new Label("memberClass", student.getClassname() != null ? student.getClassname() : "");
                                        memberItem.add(memberClassLabel);

                                        // 檢查是否為暫時變更的學生，添加特殊樣式
                                        String cssClass = "student-item ui-draggable ui-draggable-handle";
                                        if (tempGroupAssignments.containsKey(student.getId())) {
                                            cssClass += " temp-changed";
                                        }

                                        memberItem.add(new AttributeModifier("class", cssClass));
                                        memberItem.add(new AttributeModifier("data-student-id", student.getId().toString()));
                                        memberItem.setOutputMarkupId(true);

                                        logger.debug("設置組別成員項目 - ID: {}, Name: {}, Group: {}", student.getId(), studentName, group.getId());
                                    } else {
                                        memberItem.add(new Label("memberName", "載入錯誤"));
                                        memberItem.add(new Label("memberClass", ""));
                                        memberItem.add(new AttributeModifier("class", "student-item"));
                                        memberItem.add(new AttributeModifier("data-student-id", ""));
                                        memberItem.setOutputMarkupId(true);
                                    }
                                } catch (Exception e) {
                                    logger.debug("渲染組別成員時發生錯誤", e);
                                    memberItem.add(new Label("memberName", "載入錯誤"));
                                    memberItem.add(new Label("memberClass", ""));
                                    memberItem.add(new AttributeModifier("class", "student-item"));
                                    memberItem.add(new AttributeModifier("data-student-id", ""));
                                    memberItem.setOutputMarkupId(true);
                                }
                            }
                        };
                        item.add(membersList);

                        // 空組別訊息
                        WebMarkupContainer emptyGroupMessage = new WebMarkupContainer("emptyGroupMessage") {
                            @Override
                            protected void onConfigure() {
                                super.onConfigure();
                                try {
                                    // 考慮暫存變更來判斷組別是否為空
                                    Set<Classgroupmember> originalMembers = group.getClassgroupmembers();
                                    long memberCount = 0;

                                    if (originalMembers != null) {
                                        memberCount = originalMembers.stream()
                                                .filter(member -> {
                                                    Integer studentId = member.getMemberCid().getId();
                                                    Integer tempGroupId = tempGroupAssignments.get(studentId);
                                                    return tempGroupId == null || tempGroupId.equals(group.getId());
                                                }).count();
                                    }

                                    // 加上暫存分配到此組別的學生數量
                                    long tempMemberCount = tempGroupAssignments.entrySet().stream()
                                            .filter(entry -> group.getId().equals(entry.getValue())).count();

                                    setVisible((memberCount + tempMemberCount) == 0);
                                } catch (Exception e) {
                                    logger.debug("配置空組別訊息時發生錯誤", e);
                                    setVisible(true);
                                }
                            }
                        };
                        item.add(emptyGroupMessage);
                    }
                    item.setOutputMarkupId(true);
                } catch (Exception e) {
                    logger.debug("渲染組別項目時發生錯誤", e);
                    item.setOutputMarkupId(true);
                }
            }
        };
        groupsContainer.add(groupsList);

        WebMarkupContainer emptyGroupsMessage = new WebMarkupContainer("emptyGroupsMessage") {
            @Override
            protected void onConfigure() {
                super.onConfigure();
                try {
                    List<Classgroup> groups = groupManageService.getGroupsByOcid(ocid);
                    setVisible(groups == null || groups.isEmpty());
                } catch (Exception e) {
                    logger.debug("配置空狀態訊息時發生錯誤", e);
                    setVisible(true);
                }
            }
        };
        groupsContainer.add(emptyGroupsMessage);
    }

    private void initCreateGroupModal() {
        createGroupModalContainer = new WebMarkupContainer("createGroupModal");
        createGroupModalContainer.setOutputMarkupId(true);
        createGroupModalContainer.setOutputMarkupPlaceholderTag(true);
        add(createGroupModalContainer);

        CreateGroupPanel createGroupPanel = new CreateGroupPanel("createGroupPanel", ocid) {
            @Override
            protected void onGroupCreated(AjaxRequestTarget target) {
                // 強制重新載入所有模型
                detachComponentModels();

                // 隱藏模態框並刷新組別列表
                target.appendJavaScript("if (typeof window.hideModal === 'function') { window.hideModal(); }");
                target.appendJavaScript("if (typeof window.showSuccessToast === 'function') { window.showSuccessToast('組別建立成功！'); }");
                target.add(groupsContainer);
                target.add(unassignedContainer);
                target.add(feedbackPanel);

                target.appendJavaScript(" ;window.safeReinit(); ");
            }

            @Override
            protected void onCancel(AjaxRequestTarget target) {
                target.appendJavaScript("if (typeof window.hideModal === 'function') { window.hideModal(); }");
            }
        };
        createGroupModalContainer.add(createGroupPanel);
    }

    private void initActionButtons() {
        AjaxLink<Void> btnBack = new AjaxLink<Void>("btnBack") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                setResponsePage(ClassGroupPage.class);
            }
        };
        add(btnBack);

        AjaxLink<Void> addGroupButton = new AjaxLink<Void>("addGroupButton") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                logger.debug("點擊建立新組別按鈕");

                target.appendJavaScript("console.log('準備顯示模態框');");
                target.appendJavaScript(
                        "if (typeof window.showModal === 'function') {" +
                                "  console.log('調用 showModal 函數');" +
                                "  window.showModal();" +
                                "} else {" +
                                "  console.error('showModal 函數未找到');" +
                                "  alert('模態框功能未正確載入，請重新整理頁面');" +
                                "}"
                );
            }
        };
        add(addGroupButton);

        // 修改儲存按鈕，直接調用前端批次儲存
        AjaxLink<Void> saveGroupsButton = new AjaxLink<Void>("saveGroupsButton") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                // 直接調用前端的批次儲存函數
                target.appendJavaScript("if (typeof window.batchSaveAssignments === 'function') { window.batchSaveAssignments(); }");
            }
        };
        add(saveGroupsButton);
    }

    private void loadExistingGroupData() {
        try {
            if (ocid != null) {
                groupManageService.loadExistingGroups(ocid);
            } else {
                logger.warn("無法載入分組資料：ocid 為空");
            }
        } catch (Exception e) {
            logger.debug("載入現有分組資料時發生錯誤", e);
        }
    }
    @Override
    public void renderHead(IHeaderResponse response) {
        super.renderHead(response);

        // 載入 jQuery 和 jQuery UI
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/jquery.min.js"));
        response.render(JavaScriptHeaderItem.forUrl("assets/js/plugins/jquery-ui.min.js"));
        response.render(CssHeaderItem.forUrl("assets/js/plugins/jquery-ui.min.css"));

        // 載入優化版的 JavaScript 檔案
        response.render(JavaScriptHeaderItem.forReference(
                new JavaScriptResourceReference(GroupManagePage.class, "groupmanage.js")));

        // 載入 CSS 樣式
        response.render(CssHeaderItem.forCSS(generateCSS(), "groupmanage-styles"));

        // 設定批次儲存回調 URL
        response.render(OnDomReadyHeaderItem.forScript(
                "console.log('設定批次儲存回調 URL:', '" + batchSaveBehavior.getCallbackUrl() + "'); " +
                        "if (typeof window.setSaveCallbackUrl === 'function') {" +
                        "  window.setSaveCallbackUrl('" + batchSaveBehavior.getCallbackUrl() + "');" +
                        "} else {" +
                        "  setTimeout(function() { " +
                        "    if (typeof window.setSaveCallbackUrl === 'function') { " +
                        "      window.setSaveCallbackUrl('" + batchSaveBehavior.getCallbackUrl() + "'); " +
                        "    } " +
                        "  }, 1000); " +
                        "}"
        ));
    }

    private int processAssignmentsSequentially(Map<Integer, Integer> assignments, StringBuilder errorMessages) {
        int successCount = 0;

        for (Map.Entry<Integer, Integer> entry : assignments.entrySet()) {
            try {
                Integer studentId = entry.getKey();
                Integer groupId = entry.getValue();

                groupManageService.assignStudentToGroup(studentId, groupId, ocid);
                successCount++;

                logger.debug("順序處理成功：學生 {} 分配到組別 {}", studentId, groupId);

                // 在每次成功處理後稍微暫停，減少資料庫壓力
                try {
                    Thread.sleep(10); // 10毫秒間隔
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    logger.warn("處理間隔被中斷");
                }

            } catch (Exception e) {
                logger.debug("順序處理失敗 - 學生ID: {}, 組別ID: {}", entry.getKey(), entry.getValue(), e);
                if (errorMessages.length() > 0) {
                    errorMessages.append("\\n");
                }
                errorMessages.append("學生ID ").append(entry.getKey()).append(": ").append(e.getMessage());
            }
        }

        return successCount;
    }

    private String generateCSS() {
        return ".page-container { max-width: 1200px; margin: 0 auto; padding: 20px; } " +
                ".filter-section { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; } " +
                ".controls { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; } " +
                ".group-container { " +
                "  border: 2px solid #ddd; " +
                "  margin: 10px; " +
                "  padding: 15px; " +
                "  min-height: 150px; " +
                "  background-color: #f9f9f9; " +
                "  border-radius: 8px; " +
                "  box-shadow: 0 2px 4px rgba(0,0,0,0.1); " +
                "  flex: 1; " +
                "  min-width: 250px; " +
                "} " +
                ".groups-grid { display: flex; flex-wrap: wrap; gap: 15px; } " +
                ".group-header { " +
                "  font-weight: bold; " +
                "  margin-bottom: 10px; " +
                "  padding-bottom: 8px; " +
                "  border-bottom: 2px solid #007bff; " +
                "  color: #007bff; " +
                "  position: relative; " +
                "} " +
                ".student-item { " +
                "  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); " +
                "  color: white; " +
                "  border: none; " +
                "  padding: 10px 12px; " +
                "  margin: 6px; " +
                "  border-radius: 20px; " +
                "  cursor: move; " +
                "  display: inline-block; " +
                "  font-size: 14px; " +
                "  font-weight: 500; " +
                "  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); " +
                "  transition: all 0.3s ease; " +
                "} " +
                ".student-item:hover { " +
                "  transform: translateY(-2px); " +
                "  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); " +
                "} " +
                ".student-item.temp-changed { " +
                "  background: linear-gradient(135deg, #fdcb6e 0%, #e17055 100%); " +
                "  box-shadow: 0 2px 8px rgba(253, 203, 110, 0.4); " +
                "  position: relative; " +
                "} " +
                ".student-item.temp-changed::after { " +
                "  content: '●'; " +
                "  position: absolute; " +
                "  top: -3px; " +
                "  right: -3px; " +
                "  width: 12px; " +
                "  height: 12px; " +
                "  background: #ff6b6b; " +
                "  border-radius: 50%; " +
                "  font-size: 8px; " +
                "  color: white; " +
                "  display: flex; " +
                "  align-items: center; " +
                "  justify-content: center; " +
                "  animation: pulse 2s infinite; " +
                "} " +
                "@keyframes pulse { " +
                "  0% { opacity: 1; } " +
                "  50% { opacity: 0.5; } " +
                "  100% { opacity: 1; } " +
                "} " +
                ".student-class { " +
                "  font-size: 11px; " +
                "  opacity: 0.8; " +
                "  margin-left: 8px; " +
                "} " +
                ".unassigned-area { " +
                "  background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%); " +
                "  border: 2px dashed #e17055; " +
                "  min-height: 120px; " +
                "  padding: 20px; " +
                "  margin: 15px 0; " +
                "  border-radius: 12px; " +
                "  box-shadow: 0 2px 8px rgba(225, 112, 85, 0.2); " +
                "} " +
                ".unassigned-title { " +
                "  color: #d63031; " +
                "  font-weight: bold; " +
                "  margin-bottom: 15px; " +
                "  font-size: 16px; " +
                "} " +
                ".drop-target { " +
                "  border: 3px dashed #00b894 !important; " +
                "  background-color: #d1f2eb !important; " +
                "  transform: scale(1.02); " +
                "} " +
                ".drop-success { " +
                "  border: 3px solid #00b894 !important; " +
                "  background-color: #d1f2eb !important; " +
                "  animation: dropSuccess 1s ease; " +
                "} " +
                "@keyframes dropSuccess { " +
                "  0% { background-color: #d1f2eb; } " +
                "  50% { background-color: #a7f3d0; } " +
                "  100% { background-color: #f9f9f9; } " +
                "} " +
                ".btn { " +
                "  padding: 10px 20px; " +
                "  border: none; " +
                "  border-radius: 25px; " +
                "  cursor: pointer; " +
                "  font-weight: 600; " +
                "  text-decoration: none; " +
                "  transition: all 0.3s ease; " +
                "  display: inline-block; " +
                "} " +
                ".btn-primary { " +
                "  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); " +
                "  color: white; " +
                "} " +
                ".btn-success { " +
                "  background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); " +
                "  color: white; " +
                "} " +
                ".btn-success.has-changes { " +
                "  background: linear-gradient(135deg, #e17055 0%, #fd79a8 100%); " +
                "  animation: buttonPulse 2s infinite; " +
                "} " +
                "@keyframes buttonPulse { " +
                "  0% { box-shadow: 0 0 0 0 rgba(225, 112, 85, 0.7); } " +
                "  70% { box-shadow: 0 0 0 10px rgba(225, 112, 85, 0); } " +
                "  100% { box-shadow: 0 0 0 0 rgba(225, 112, 85, 0); } " +
                "} " +
                ".btn-secondary { " +
                "  background: linear-gradient(135deg, #636e72 0%, #2d3436 100%); " +
                "  color: white; " +
                "} " +
                ".btn-danger { " +
                "  background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%); " +
                "  color: white; " +
                "  font-size: 12px; " +
                "  padding: 6px 12px; " +
                "  position: absolute; " +
                "  top: -5px; " +
                "  right: -5px; " +
                "} " +
                ".btn:hover { " +
                "  transform: translateY(-2px); " +
                "  box-shadow: 0 4px 12px rgba(0,0,0,0.2); " +
                "} " +
                ".class-filter { " +
                "  padding: 8px 12px; " +
                "  border: 2px solid #ddd; " +
                "  border-radius: 20px; " +
                "  background: white; " +
                "  font-size: 14px; " +
                "  min-width: 150px; " +
                "} " +
                ".custom-modal { " +
                "  position: fixed; " +
                "  top: 0; " +
                "  left: 0; " +
                "  width: 100%; " +
                "  height: 100%; " +
                "  background: rgba(0, 0, 0, 0.5); " +
                "  display: none; " +
                "  z-index: 1050; " +
                "  align-items: center; " +
                "  justify-content: center; " +
                "} " +
                ".custom-modal.show { " +
                "  display: flex; " +
                "} " +
                ".modal-content { " +
                "  background: white; " +
                "  border-radius: 8px; " +
                "  padding: 0; " +
                "  max-width: 500px; " +
                "  width: 90%; " +
                "  max-height: 90%; " +
                "  overflow-y: auto; " +
                "  position: relative; " +
                "  animation: modalSlideIn 0.3s ease; " +
                "  box-shadow: 0 10px 30px rgba(0,0,0,0.3); " +
                "} " +
                ".toast { " +
                "  position: fixed; " +
                "  top: 20px; " +
                "  right: 20px; " +
                "  padding: 15px 20px; " +
                "  border-radius: 8px; " +
                "  color: white; " +
                "  font-weight: 500; " +
                "  z-index: 2000; " +
                "  transform: translateX(400px); " +
                "  transition: transform 0.3s ease; " +
                "  box-shadow: 0 4px 12px rgba(0,0,0,0.2); " +
                "} " +
                ".toast.show { " +
                "  transform: translateX(0); " +
                "} " +
                ".success-toast { " +
                "  background: linear-gradient(135deg, #00b894 0%, #00cec9 100%); " +
                "} " +
                ".error-toast { " +
                "  background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%); " +
                "} " +
                ".warning-toast { " +
                "  background: linear-gradient(135deg, #fdcb6e 0%, #e17055 100%); " +
                "} " +
                ".info-toast { " +
                "  background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%); " +
                "} " +
                ".temp-success-toast { " +
                "  background: linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%); " +
                "} " +
                ".loading-overlay { " +
                "  position: fixed; " +
                "  top: 0; " +
                "  left: 0; " +
                "  width: 100%; " +
                "  height: 100%; " +
                "  background: rgba(0,0,0,0.3); " +
                "  display: none; " +
                "  z-index: 1500; " +
                "  align-items: center; " +
                "  justify-content: center; " +
                "} " +
                ".unsaved-changes-indicator { " +
                "  position: fixed; " +
                "  top: 70px; " +
                "  right: 20px; " +
                "  background: linear-gradient(135deg, #fdcb6e 0%, #e17055 100%); " +
                "  color: white; " +
                "  padding: 8px 15px; " +
                "  border-radius: 20px; " +
                "  font-size: 12px; " +
                "  z-index: 1000; " +
                "  display: none; " +
                "  animation: slideInFromRight 0.3s ease; " +
                "} " +
                "@keyframes slideInFromRight { " +
                "  from { transform: translateX(100%); } " +
                "  to { transform: translateX(0); } " +
                "}";
    }

    // Getter 和 Setter 方法
    public String getSelectedClassName() {
        return selectedClassName;
    }

    public void setSelectedClassName(String selectedClassName) {
        this.selectedClassName = selectedClassName;
        logger.debug("設定選擇的班級名稱: {}", selectedClassName);
    }

    public Integer getOcid() {
        return ocid;
    }

    public void setOcid(Integer ocid) {
        this.ocid = ocid;
        logger.debug("設定開課ID: {}", ocid);
    }

    public Integer getSchoolId() {
        return schoolId;
    }

    public boolean getHasUnsavedChanges() {
        return hasUnsavedChanges;
    }

    // 用於調試的方法
    @Override
    protected void onBeforeRender() {
        super.onBeforeRender();
        logger.debug("GroupManagePage 即將渲染 - ocid: {}, selectedClassName: {}, 暫存變更: {}",
                ocid, selectedClassName, tempGroupAssignments.size());
    }

    @Override
    protected void onAfterRender() {
        super.onAfterRender();
        logger.debug("GroupManagePage 渲染完成");
    }

    // 頁面清理方法
    @Override
    protected void onDetach() {
        super.onDetach();
        // 確保所有模型都被正確分離
        detachComponentModels();
    }
}