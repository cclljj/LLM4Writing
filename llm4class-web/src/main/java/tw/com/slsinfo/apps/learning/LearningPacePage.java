package tw.com.slsinfo.apps.learning;

import org.apache.wicket.model.IModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;

@MountPath("/apps/learningpace")
public class LearningPacePage extends BaseAppPage {
    public LearningPacePage() {
    }

    public LearningPacePage(IModel<?> model) {
        super(model);
    }

    public LearningPacePage(PageParameters parameters) {
        super(parameters);
    }
}
