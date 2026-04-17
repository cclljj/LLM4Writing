package tw.com.slsinfo.apps.stlearning;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.markup.html.basic.Label;
import org.apache.wicket.markup.repeater.Item;
import org.apache.wicket.markup.repeater.data.DataView;
import org.apache.wicket.markup.repeater.data.ListDataProvider;
import org.apache.wicket.model.IModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;
import tw.com.slsinfo.essayai.models.course.STActivityModel;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.essayai.services.ClassgroupmemberService;
import tw.com.slsinfo.modal.course.CourseDetailModal;

import java.util.List;


/**
 * 學生參與活動List
 */
@MountPath("/apps/st/activity")
public class ActivityPage extends BaseAppPage {

    private transient List<STActivityModel> members;

    private CourseDetailModal courseDetailModal;

    public ActivityPage() {
    }

    private static final Logger logger = LogManager.getLogger(ActivityPage.class);

    private String llmtype = "llm4class";

    public ActivityPage(IModel<?> model) {
        super(model);
    }

    public ActivityPage(PageParameters parameters) {
        super(parameters);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();

        add(new Label("username", getWicketSession().getTrueName()));

        // 初始化課程詳細資訊 Modal
        courseDetailModal = new CourseDetailModal("courseDetailModal") {
            private static final long serialVersionUID = 1L;

            @Override
            protected void onConfirm(AjaxRequestTarget target, STActivityModel activityModel) {
                logger.debug("--------User confirmed to start learning for activity: {}", activityModel.getTitle());

                // 關閉 Modal
                close(target);

                // 建立 ChatPageModel 並跳轉到下一個階段
                ChatPageModel chatPageModel = createChatPageModel(activityModel);
                navigateToNextPhase(chatPageModel);
            }

            @Override
            protected void onCancel(AjaxRequestTarget target) {
                logger.debug("User cancelled course detail modal");
                // 關閉 Modal
                close(target);
            }
        };

        // 取得產品資料
        members = CDI.current().select(ClassgroupmemberService.class).get().findActivityByUid(getWicketSession().getUid(), llmtype);

        // 建立資料提供者
        ListDataProvider<STActivityModel> dataProvider = new ListDataProvider<>(members);

        // 建立 DataView (Repeater)
        DataView<STActivityModel> dataRepeater = new DataView<>("dataRepeater", dataProvider) {
            @Override
            protected void populateItem(Item<STActivityModel> item) {
                STActivityModel data = item.getModelObject();
                item.add(new Label("title", data.getTitle()));
                item.add(new Label("groupname", data.getGroupname()));

                AjaxLink<Void> detailLink = new AjaxLink<>("detailLink") {
                    @Override
                    public void onClick(AjaxRequestTarget target) {
                        // 設定 Modal 的資料並顯示
                        courseDetailModal.setData(data, target);
                        courseDetailModal.show(target);
                    }
                };
                item.add(detailLink);
            }
        };

        // 設定每頁顯示筆數
        dataRepeater.setItemsPerPage(5);
        add(dataRepeater, courseDetailModal);
    }
}
