package tw.com.slsinfo.essayai.controls;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.wicket.markup.html.form.ChoiceRenderer;
import org.apache.wicket.markup.html.form.DropDownChoice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.models.course.EssayViewModel;
import tw.com.slsinfo.essayai.models.course.OpenClassesView;
import tw.com.slsinfo.essayai.services.EssayService;

import java.util.List;

public class EssayDropDownChoice extends DropDownChoice<EssayViewModel> {

    private static final Logger logger = LoggerFactory.getLogger(EssayDropDownChoice.class);

    private List<EssayViewModel> essayViewModels;
    private Integer sid; // 保存 sid 以供後續使用

    public EssayDropDownChoice(String id, Integer sid, String llmtype) {
        super(id);
        this.sid = sid;
        init(true, sid, llmtype);
    }

    public EssayDropDownChoice(String id, boolean required, Integer sid, String llmtype) {
        super(id);
        this.sid = sid;
        init(required, sid, llmtype);
    }

    public void init(boolean required, Integer sid, String llmtype) {
        essayViewModels = CDI.current().select(EssayService.class).get().getEnableEssay(sid, llmtype);
        setChoices(essayViewModels);
        setOutputMarkupId(true);
        setRequired(required);
        setChoiceRenderer(new ChoiceRenderer<EssayViewModel>() {

            @Override
            public Object getDisplayValue(EssayViewModel object) {
                return object.getTitle();
            }

            @Override
            public String getIdValue(EssayViewModel object, int index) {
                return String.valueOf(object.getId());
            }

        });
        setDefault();
    }

    /**
     * 根據 OpenClassesView 設定下拉選單的值
     *
     * @param openClassesView 包含資料的模型物件
     */
    public void setModelObjectFromView(OpenClassesView openClassesView, String llmtype) {
        if (openClassesView == null) {
            setModelObject(null);
            return;
        }

        logger.debug("設定EssayDropDownChoice，essay: {}, eid: {}",
                openClassesView.getEssay(), openClassesView.getEid());

        // 設定Essay下拉選單的預設值
        if (openClassesView.getEssay() != null) {
            setModelObject(openClassesView.getEssay());
            logger.debug("直接設定 Essay 物件: {}", openClassesView.getEssay().getId());
        } else if (openClassesView.getEid() > 0) {
            // 如果 essay 物件為空但有 essay_id，需要根據 id 找到對應的 EssayView
            try {
                List<EssayViewModel> allEssays = CDI.current().select(EssayService.class).get().getAllEssay(sid, llmtype);
                EssayViewModel selectedEssay = allEssays.stream()
                        .filter(essay -> essay.getId() == openClassesView.getEid())
                        .findFirst()
                        .orElse(null);

                if (selectedEssay != null) {
                    setModelObject(selectedEssay);
                    // 同時更新 model 中的 essay 物件
                    openClassesView.setEssay(selectedEssay);
                    logger.debug("根據 eid 設定 Essay 物件: {}", selectedEssay.getId());
                } else {
                    logger.warn("找不到 eid 對應的 Essay: {}", openClassesView.getEid());
                    setModelObject(null);
                }
            } catch (Exception e) {
                logger.debug("根據 essay_id 查找 Essay 失敗: {}", openClassesView.getEid(), e);
                setModelObject(null);
            }
        } else {
            setModelObject(null);
            logger.debug("essay 和 eid 都為空，設定為 null");
        }
    }

    /**
     * 給於預設
     *
     * @return
     */
    protected void setDefault() {

    }
}
