package tw.com.slsinfo.modal.course;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.ajax.markup.html.form.AjaxSubmitLink;
import org.apache.wicket.core.request.handler.IPartialPageRequestHandler;
import org.apache.wicket.markup.html.WebMarkupContainer;
import org.apache.wicket.markup.html.form.CheckBoxMultipleChoice;
import org.apache.wicket.markup.html.form.Form;
import org.apache.wicket.markup.html.form.IChoiceRenderer;
import org.apache.wicket.markup.html.form.TextField;
import org.apache.wicket.markup.html.list.ListItem;
import org.apache.wicket.markup.html.list.ListView;
import org.apache.wicket.markup.html.panel.FeedbackPanel;
import org.apache.wicket.model.CompoundPropertyModel;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.LoadableDetachableModel;
import org.apache.wicket.model.PropertyModel;
import tw.com.slsinfo.commons.wicket.components.blockui.AjaxSubmitLinkBlockUI;
import tw.com.slsinfo.commons.wicket.modal.BaseModal;
import tw.com.slsinfo.essayai.models.course.ClassGroupModel;
import tw.com.slsinfo.essayai.models.course.ClassinfoViewModel;
import tw.com.slsinfo.essayai.models.course.OpenClassesView;
import tw.com.slsinfo.essayai.services.ClassGroupService;
import tw.com.slsinfo.essayai.services.ClassInfoService;
import tw.com.slsinfo.model.course.ClassGroupRowModel;

import java.util.ArrayList;
import java.util.List;

public class GroupManagementModal extends BaseModal<OpenClassesView> {
    private static final Logger logger = LogManager.getLogger(GroupManagementModal.class);
    private static final long serialVersionUID = 1L;

    private OpenClassesView model;
    private final int sid;
    private List<ClassGroupRowModel> groupRows;
    private List<ClassinfoViewModel> availableStudents;
    private WebMarkupContainer groupContainer;
    private Form<Void> groupForm;
    private FeedbackPanel feedbackPanel;
    private ListView<ClassGroupRowModel> groupListView;
    private final String llmtype;

    public GroupManagementModal(String id, int sid, String llmtype) {
        super(id);
        this.sid = sid;
        this.groupRows = new ArrayList<>();
        this.availableStudents = new ArrayList<>();
        this.llmtype = llmtype;
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();

        model = new OpenClassesView();
        feedbackPanel = new FeedbackPanel("feedbackPanel");
        feedbackPanel.setOutputMarkupId(true);

        groupForm = new Form<>("groupForm");
        groupForm.setDefaultModel(new CompoundPropertyModel<>(model));
        groupForm.setOutputMarkupId(true);

        // 新增分組按鈕
        AjaxLink<Void> addGroupBtn = new AjaxLink<Void>("addGroupBtn") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                addNewGroup();
                target.add(groupContainer);
            }
        };

        // 分組列表容器
        groupContainer = new WebMarkupContainer("groupContainer");
        groupContainer.setOutputMarkupId(true);

        // 使用ListView替代RepeatingView以獲得更好的控制
        groupListView = new ListView<ClassGroupRowModel>("groupList",
                new PropertyModel<List<ClassGroupRowModel>>(this, "groupRows")) {
            @Override
            protected void populateItem(ListItem<ClassGroupRowModel> item) {
                final ClassGroupRowModel groupRow = item.getModelObject();
                final int index = item.getIndex();

                // 分組名稱輸入框
                TextField<String> groupNameField = new TextField<>("groupName",
                        new PropertyModel<String>(groupRow, "groupName"));
                groupNameField.setRequired(true);

                // 建立多選框 - 每個分組使用獨立的Model
                CheckBoxMultipleChoice<ClassinfoViewModel> memberChoice =
                        new CheckBoxMultipleChoice<ClassinfoViewModel>("selectedMembers",
                                // 選中的成員模型 - 直接使用PropertyModel
                                new PropertyModel<List<ClassinfoViewModel>>(groupRow, "selectedMembers"),
                                // 可用學生選項
                                new LoadableDetachableModel<List<ClassinfoViewModel>>() {
                                    @Override
                                    protected List<ClassinfoViewModel> load() {
                                        return new ArrayList<>(availableStudents);
                                    }
                                },
                                // 選擇器
                                new IChoiceRenderer<ClassinfoViewModel>() {
                                    @Override
                                    public Object getDisplayValue(ClassinfoViewModel object) {
                                        if (object == null) return "";
                                        return object.getName() + " (" + object.getClassname() + ")";
                                    }

                                    @Override
                                    public String getIdValue(ClassinfoViewModel object, int index) {
                                        if (object == null) return "";
                                        return String.valueOf(object.getId());
                                    }

                                    @Override
                                    public ClassinfoViewModel getObject(String id,
                                                                        IModel<? extends List<? extends ClassinfoViewModel>> choices) {
                                        if (choices == null || choices.getObject() == null || id == null) {
                                            return null;
                                        }
                                        try {
                                            int studentId = Integer.parseInt(id);
                                            return choices.getObject().stream()
                                                    .filter(student -> student != null && student.getId() == studentId)
                                                    .findFirst()
                                                    .orElse(null);
                                        } catch (NumberFormatException e) {
                                            logger.warn("無法解析學生ID: {}", id);
                                            return null;
                                        }
                                    }
                                });

                memberChoice.setOutputMarkupId(true);

                // 刪除分組按鈕
                AjaxLink<Void> deleteBtn = new AjaxLink<Void>("deleteBtn") {
                    @Override
                    public void onClick(AjaxRequestTarget target) {
                        if (groupRows.size() > 1) {
                            groupRows.remove(groupRow);
                            target.add(groupContainer);
                        } else {
                            error("至少需要保留一個分組");
                            target.add(feedbackPanel);
                        }
                    }
                };

                item.add(groupNameField, memberChoice, deleteBtn);
            }
        };

        groupListView.setOutputMarkupId(true);

        // 儲存按鈕
        AjaxSubmitLink saveBtn = new AjaxSubmitLinkBlockUI("saveBtn", groupForm) {
            @Override
            protected void onSubmit(AjaxRequestTarget target) {
                try {
                    // 驗證分組資料
                    if (!validateGroups()) {
                        error("分組資料驗證失敗，請檢查分組名稱和成員選擇");
                        target.add(feedbackPanel);
                        return;
                    }

                    List<ClassGroupModel> savedGroups = saveGroups(model.getId());
                    // 實際呼叫服務儲存到資料庫
                    CDI.current().select(ClassGroupService.class).get().saveClassGroups(model.getId(), savedGroups);

                    success("分組儲存成功！");
                    close(target);
                    onResponse(model, target);
                } catch (Exception e) {
                    logger.debug("儲存分組失敗", e);
                    error("儲存分組失敗：" + e.getMessage());
                    target.add(feedbackPanel);
                }
            }

            @Override
            protected void onError(AjaxRequestTarget target) {
                target.add(feedbackPanel);
            }
        };

        // 取消按鈕
        AjaxLink<Void> cancelBtn = new AjaxLink<Void>("cancelBtn") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                close(target);
            }
        };

        groupContainer.add(groupListView);
        groupForm.add(addGroupBtn, groupContainer);
        add(groupForm, saveBtn, cancelBtn, feedbackPanel);
    }

    @Override
    public void show(IPartialPageRequestHandler target) {
        logger.debug("顯示分組管理模態框 - model: {}", model != null ? model.getId() : "null");

        // 在show之前確保資料已載入
        if (model != null && model.getId() != null) {
            try {
                loadData(model);
                logger.debug("資料載入完成，共 {} 個分組", groupRows.size());
            } catch (Exception e) {
                logger.debug("載入分組資料失敗", e);
                error("載入分組資料失敗：" + e.getMessage());
                // 建立預設分組以防止顯示錯誤
                createDefaultGroup();
            }
        } else {
            logger.warn("模型或ID為空，建立預設分組");
            createDefaultGroup();
        }

        super.show(target);
    }

    /**
     * 建立預設分組
     */
    private void createDefaultGroup() {
        groupRows.clear();
        ClassGroupRowModel defaultGroup = new ClassGroupRowModel();
        defaultGroup.setGroupName("第1組");
        defaultGroup.setSelectedMembers(new ArrayList<>());
        groupRows.add(defaultGroup);
        logger.debug("建立預設分組");
    }

    /**
     * 載入資料
     */
    private void loadData(OpenClassesView openClass) {
        try {
            logger.debug("載入分組資料 - 課程ID: {}, 學校ID: {}", openClass.getId(), sid);

            // 載入可用學生清單
            ClassInfoService classInfoService = CDI.current().select(ClassInfoService.class).get();
            List<ClassinfoViewModel> students = classInfoService.getStuClassinfoView(sid, llmtype);
            if (students == null) {
                students = new ArrayList<>();
            }

            // 清空並重新設定可用學生清單
            availableStudents.clear();
            availableStudents.addAll(students);
            logger.debug("載入到 {} 個可用學生", availableStudents.size());

            // 載入現有分組資料
            ClassGroupService classGroupService = CDI.current().select(ClassGroupService.class).get();
            List<ClassGroupModel> existingGroups = classGroupService.getClassGroupsByOpenClass(openClass.getId());
            logger.debug("載入到 {} 個現有分組", existingGroups != null ? existingGroups.size() : 0);

            // 清空現有的分組資料
            groupRows.clear();

            if (existingGroups == null || existingGroups.isEmpty()) {
                // 如果沒有現有分組，建立一個空的分組
                logger.debug("沒有現有分組，建立預設分組");
                createDefaultGroup();
            } else {
                // 載入現有分組資料
                for (ClassGroupModel group : existingGroups) {
                    ClassGroupRowModel rowModel = new ClassGroupRowModel();
                    rowModel.setId(group.getId());
                    rowModel.setGroupName(group.getGroupname());

                    // 為每個分組創建獨立的成員列表
                    List<ClassinfoViewModel> members = new ArrayList<>();
                    if (group.getMembers() != null) {
                        // 從現有成員中匹配可用學生
                        for (ClassinfoViewModel member : group.getMembers()) {
                            // 確保成員在可用學生清單中
                            ClassinfoViewModel matchedStudent = availableStudents.stream()
                                    .filter(s -> s.getId() == member.getId())
                                    .findFirst()
                                    .orElse(null);
                            if (matchedStudent != null) {
                                members.add(matchedStudent);
                            }
                        }
                    }
                    rowModel.setSelectedMembers(members);
                    groupRows.add(rowModel);

                    logger.debug("載入分組: {} (ID: {}), 成員數: {}",
                            group.getGroupname(), group.getId(), members.size());
                }
            }

            logger.debug("最終載入 {} 個分組資料", groupRows.size());
        } catch (Exception e) {
            logger.debug("載入分組資料失敗", e);
            throw new RuntimeException("載入分組資料失敗：" + e.getMessage(), e);
        }
    }

    /**
     * 新增新的分組列
     */
    private void addNewGroup() {
        ClassGroupRowModel newGroup = new ClassGroupRowModel();
        newGroup.setGroupName("第" + (groupRows.size() + 1) + "組");
        newGroup.setSelectedMembers(new ArrayList<>());
        groupRows.add(newGroup);
        logger.debug("新增分組: {}", newGroup.getGroupName());
    }

    /**
     * 驗證分組資料
     */
    private boolean validateGroups() {
        if (groupRows == null || groupRows.isEmpty()) {
            logger.warn("分組資料為空");
            return false;
        }

        for (ClassGroupRowModel group : groupRows) {
            if (group.getGroupName() == null || group.getGroupName().trim().isEmpty()) {
                logger.warn("發現空的分組名稱");
                return false;
            }
        }

        return true;
    }

    /**
     * 儲存分組資料
     */
    private List<ClassGroupModel> saveGroups(int ocid) {
        if (groupRows == null || groupRows.isEmpty()) {
            throw new RuntimeException("分組資料不存在");
        }

        List<ClassGroupModel> groupsToSave = new ArrayList<>();

        for (ClassGroupRowModel rowModel : groupRows) {
            if (rowModel.getGroupName() != null && !rowModel.getGroupName().trim().isEmpty()) {
                ClassGroupModel group = new ClassGroupModel();
                group.setId(rowModel.getId());
                group.setOcid(ocid);
                group.setGroupname(rowModel.getGroupName().trim());

                // 確保成員列表是新的實例
                List<ClassinfoViewModel> members = new ArrayList<>();
                if (rowModel.getSelectedMembers() != null) {
                    members.addAll(rowModel.getSelectedMembers());
                }
                group.setMembers(members);

                groupsToSave.add(group);

                logger.debug("準備儲存分組 '{}': {} 個成員", group.getGroupname(), members.size());
            }
        }

        return groupsToSave;
    }

    // Getter 和 Setter 方法
    public List<ClassGroupRowModel> getGroupRows() {
        return groupRows;
    }

    public void setGroupRows(List<ClassGroupRowModel> groupRows) {
        this.groupRows = groupRows != null ? groupRows : new ArrayList<>();
    }

    public List<ClassinfoViewModel> getAvailableStudents() {
        return availableStudents;
    }

    public void setAvailableStudents(List<ClassinfoViewModel> availableStudents) {
        this.availableStudents = availableStudents != null ? availableStudents : new ArrayList<>();
    }

    @Override
    public void setModelObject(OpenClassesView openClassesView) {
        logger.debug("設置模型對象: {}", openClassesView != null ? openClassesView.getId() : "null");
        this.model = openClassesView;

        if (groupForm != null) {
            groupForm.setDefaultModel(new CompoundPropertyModel<>(model));
        }
    }
}