package tw.com.slsinfo.modal.course;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.markup.html.basic.Label;
import org.apache.wicket.model.LoadableDetachableModel;
import org.apache.wicket.model.Model;
import tw.com.slsinfo.commons.wicket.modal.BaseModal;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagelog;
import tw.com.slsinfo.essayai.models.course.OpenClassesView;
import tw.com.slsinfo.essayai.models.course.STActivityModel;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.essayai.services.OpenclassService;
import tw.com.slsinfo.essayai.services.StageService;
import tw.com.slsinfo.essayai.utils.WebUtils;

import java.lang.reflect.InvocationTargetException;
import java.util.List;

/**
 * 課程詳細資訊 Modal
 */
public abstract class CourseDetailModal extends BaseModal<STActivityModel> {

    private static final Logger logger = LogManager.getLogger(CourseDetailModal.class);

    private STActivityModel stActivityModel;
    private Label titleLabel;
    private Label groupLabel;
    private Label groupmemberLabel;
    private Label courseDescriptionLabel;
    private Label essayDescriptionLabel;

    public CourseDetailModal(String id) {
        super(id);
        init();
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
    }

    private void init() {
        stActivityModel = new STActivityModel();

        // 課程標題
        titleLabel = new Label("courseTitle", Model.of(""));
        titleLabel.setOutputMarkupId(true); // 重要：設定輸出 markup id
        add(titleLabel);

        // 群組名稱
        groupLabel = new Label("groupName", Model.of(""));
        groupLabel.setOutputMarkupId(true); // 重要：設定輸出 markup id
        add(groupLabel);

        // 組員名單
        groupmemberLabel = new Label("groupmemberLabel", Model.of(""));
        groupmemberLabel.setOutputMarkupId(true); // 重要：設定輸出 markup id
        add(groupmemberLabel);

        // 課程說明
        courseDescriptionLabel = new Label("courseDescription", Model.of(""));
        courseDescriptionLabel.setOutputMarkupId(true); // 重要：設定輸出 markup id
        add(courseDescriptionLabel);

        // 文章說明
        essayDescriptionLabel = new Label("essayDescription", Model.of(""));
        essayDescriptionLabel.setOutputMarkupId(true); // 重要：設定輸出 markup id
        add(essayDescriptionLabel);

        // 確認按鈕 - 開始學習
        AjaxLink<Void> confirmButton = new AjaxLink<Void>("confirmButton") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                if (stActivityModel != null) {
                    onConfirm(target, stActivityModel);
                } else {

                }
            }
        };
        add(confirmButton);

        // 取消按鈕
        AjaxLink<Void> cancelButton = new AjaxLink<Void>("cancelButton") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                onCancel(target);
            }
        };
        add(cancelButton);
    }

    // 修正：加入 AjaxRequestTarget 參數
    public void setData(STActivityModel activityModel, AjaxRequestTarget target) {

        this.stActivityModel = activityModel;

        if (activityModel != null) {

            // 直接更新 Label 的 Model
            titleLabel.setDefaultModel(Model.of(activityModel.getTitle()));
            groupLabel.setDefaultModel(Model.of(activityModel.getGroupname()));
            groupmemberLabel.setDefaultModel(Model.of(activityModel.getMemberlist()));

            // 載入課程詳細資訊
            OpenClassesView view = CDI.current().select(OpenclassService.class).get()
                    .getOpenClasses(activityModel.getOcid());

            if (view != null) {
                courseDescriptionLabel.setDefaultModel(Model.of(view.getSupplementarytxt()));

                if (view.getEssay() != null) {
                    essayDescriptionLabel.setDefaultModel(Model.of(view.getEssay().getSupplementarytxt()));
                } else {
                    essayDescriptionLabel.setDefaultModel(Model.of(""));
                }
            } else {
                courseDescriptionLabel.setDefaultModel(Model.of(""));
                essayDescriptionLabel.setDefaultModel(Model.of(""));
            }

            // 重要：將更新的元件加入到 AjaxRequestTarget 中
            if (target != null) {
                target.add(titleLabel);
                target.add(groupLabel);
                target.add(groupmemberLabel);
                target.add(courseDescriptionLabel);
                target.add(essayDescriptionLabel);
            }

        } else {
            logger.debug("----------setData: activityModel is null");

            // 設定空值
            titleLabel.setDefaultModel(Model.of(""));
            groupLabel.setDefaultModel(Model.of(""));
            groupmemberLabel.setDefaultModel(Model.of(""));
            courseDescriptionLabel.setDefaultModel(Model.of(""));
            essayDescriptionLabel.setDefaultModel(Model.of(""));

            // 重要：將更新的元件加入到 AjaxRequestTarget 中
            if (target != null) {
                target.add(titleLabel);
                target.add(groupLabel);
                target.add(groupmemberLabel);
                target.add(courseDescriptionLabel);
                target.add(essayDescriptionLabel);
            }
        }
    }

    /**
     * 確認按鈕點擊事件
     *
     * @param target        Ajax目標
     * @param activityModel 活動模型
     */
    protected abstract void onConfirm(AjaxRequestTarget target, STActivityModel activityModel);

    /**
     * 取消按鈕點擊事件
     *
     * @param target Ajax目標
     */
    protected abstract void onCancel(AjaxRequestTarget target);

    /**
     * 建立 ChatPageModel 並跳轉到下一個階段
     * 此方法可供繼承類別使用，包含原本的跳轉邏輯
     */
    protected ChatPageModel createChatPageModel(STActivityModel data) {
        ChatPageModel chatPageModel = new ChatPageModel();

        // 必須搜尋table: stagelog以判定繼續往下進行未進行的階段
        List<Stagelog> stagelogs = CDI.current().select(StageService.class).get()
                .findCurrentStagelog(data.getMembercid(), data.getCgid());

        if (stagelogs.isEmpty()) {
            chatPageModel.setActive(1);
            chatPageModel.setPreviousId("");
        } else {
            Stagelog stagelog = stagelogs.get(0);
            chatPageModel.setActive(stagelog.getStageid().getId());
            chatPageModel.setPreviousId(stagelog.getMessageid());
        }

        chatPageModel.setTitle(data.getTitle());
        chatPageModel.setEssayid(data.getEssayid());
        chatPageModel.setGenreid(data.getGenreid());
        chatPageModel.setCgid(data.getCgid());
        chatPageModel.setOcid(data.getOcid());
        chatPageModel.setId(data.getId());
        chatPageModel.setGroupid(data.getCgid());
        chatPageModel.setGroupname(data.getGroupname());
        chatPageModel.setMembercid(data.getMembercid());

        // 反查openclass與essay資料來源
        OpenClassesView view = CDI.current().select(OpenclassService.class).get()
                .getOpenClasses(data.getOcid());
        chatPageModel.addInitPrompt(view.getSupplementarytxt())
                .addInitPrompt(view.getEssay().getSupplementarytxt());

        return chatPageModel;
    }

    /**
     * 執行頁面跳轉到下一個階段
     * 此方法可供繼承類別使用
     */
    protected void navigateToNextPhase(ChatPageModel chatPageModel) {
        WebUtils.getNextPage(chatPageModel.getActive()).ifPresentOrElse(constructor -> {
            try {
                LoadableDetachableModel<ChatPageModel> model = new LoadableDetachableModel<ChatPageModel>() {
                    @Override
                    protected ChatPageModel load() {
                        return chatPageModel;
                    }
                };
                getPage().setResponsePage(constructor.newInstance(model, chatPageModel.getActive()));
            } catch (InstantiationException | IllegalAccessException | InvocationTargetException e) {
                logger.debug("Error creating new phase page", e);
                throw new RuntimeException(e);
            }
        }, () -> logger.debug("Cannot create new phase page"));
    }
}