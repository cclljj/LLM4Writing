package tw.com.slsinfo.essayai.controls;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.wicket.markup.html.form.ChoiceRenderer;
import org.apache.wicket.markup.html.form.DropDownChoice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.models.course.OpenClassesView;
import tw.com.slsinfo.essayai.services.OpenclassService;

import java.util.List;

public class ClassnameDropDownChoice extends DropDownChoice<OpenClassesView> {

    private static final Logger logger = LoggerFactory.getLogger(ClassnameDropDownChoice.class);

    private List<OpenClassesView> openClassesViews;

    public ClassnameDropDownChoice(String id, boolean required, Integer sid, String llmtype) {
        super(id);
        init(required, sid, llmtype);
    }

    public void init(boolean required, Integer sid, String llmtype) {
        openClassesViews = CDI.current().select(OpenclassService.class).get().getAllOpenClasses(sid, llmtype);
        setChoices(openClassesViews);
        setOutputMarkupId(true);
        setRequired(required);
        setChoiceRenderer(new ChoiceRenderer<OpenClassesView>() {

            @Override
            public Object getDisplayValue(OpenClassesView object) {
                return object.getClassname();
            }

            @Override
            public String getIdValue(OpenClassesView object, int index) {
                return object.getClassname();
            }

        });
        setDefault();
    }

    /**
     * 如果 subjectList 只有一個，就自動設定預設值；
     * 若多筆，讓使用者自己選。
     *
     * @return
     */
    public OpenClassesView getOnlyIfSingleChoice() {
//        if (openClassesViews.size() == 1) {
        return openClassesViews.get(0);
//        } else {
//            return null;
//        }
    }


    /**
     * 給於預設
     *
     * @return
     */
    protected void setDefault() {

    }
}
