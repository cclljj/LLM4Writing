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
import org.apache.wicket.model.LoadableDetachableModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagelog;
import tw.com.slsinfo.essayai.models.course.OpenClassesView;
import tw.com.slsinfo.essayai.models.course.STActivityModel;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.essayai.services.ClassgroupmemberService;
import tw.com.slsinfo.essayai.services.OpenclassService;
import tw.com.slsinfo.essayai.services.StageService;

import java.lang.reflect.InvocationTargetException;
import java.util.List;

import static tw.com.slsinfo.essayai.utils.WebUtils.getNextPage;

@MountPath("/apps/st/activity_bk")
public class ActivityPage_bk extends BaseAppPage {

    private transient List<STActivityModel> members;

    public ActivityPage_bk() {
    }

    private static final Logger logger = LogManager.getLogger(ActivityPage_bk.class);

    private String llmtype = "llm4class";

    public ActivityPage_bk(IModel<?> model) {
        super(model);
    }

    public ActivityPage_bk(PageParameters parameters) {
        super(parameters);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();

        add(new Label("username", getWicketSession().getTrueName()));

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
                        LoadableDetachableModel<ChatPageModel> chatPageModelLoadableDetachableModel
                                = new LoadableDetachableModel<>() {

                            @Override
                            protected ChatPageModel load() {
                                ChatPageModel chatPageModel = new ChatPageModel();
                                //必須搜尋table: stagelog以判定繼續往下進行未進行的階段
                                List<Stagelog> stagelogs
                                        = CDI.current().select(StageService.class).get()
                                        .findCurrentStagelog(data.getMembercid(), data.getCgid());
                                if (stagelogs.isEmpty()) {
                                    chatPageModel.setActive(1);
                                } else {
                                    Stagelog stagelog = stagelogs.get(0);
                                    chatPageModel.setActive(stagelog.getStageid().getId());
                                    chatPageModel.setPreviousId(stagelog.getResponseid());
                                }

                                chatPageModel.setTitle(data.getTitle());
                                chatPageModel.setCgid(data.getCgid());
                                chatPageModel.setOcid(data.getOcid());
                                chatPageModel.setId(data.getId());
                                chatPageModel.setGroupname(data.getGroupname());
                                chatPageModel.setMembercid(data.getMembercid());

                                //反查openclass與essay資料來源
                                OpenClassesView view = CDI.current().select(OpenclassService.class).get().getOpenClasses(data.getOcid());
                                chatPageModel.addInitPrompt(view.getSupplementarytxt())
                                        .addInitPrompt(view.getEssay().getSupplementarytxt());

                                return chatPageModel;
                            }
                        };

                        getNextPage(chatPageModelLoadableDetachableModel.getObject().getActive()).ifPresentOrElse(constructor -> {
                                    try {
                                        setResponsePage(constructor.newInstance(chatPageModelLoadableDetachableModel, chatPageModelLoadableDetachableModel.getObject().getActive()));
                                    } catch (InstantiationException | IllegalAccessException |
                                             InvocationTargetException e) {
                                        throw new RuntimeException(e);
                                    }
                                },
                                () -> logger.debug("Cannot create new phase page"));
                    }
                };
                item.add(detailLink);
            }
        };

        // 設定每頁顯示筆數
        dataRepeater.setItemsPerPage(5);

        add(dataRepeater);

    }
}
