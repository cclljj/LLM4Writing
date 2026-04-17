package tw.com.slsinfo.apps.stlearning;

import org.apache.wicket.model.IModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;


@MountPath("/apps/st/progress")
public class ProgressPage extends BaseAppPage {
    public ProgressPage() {
    }

    public ProgressPage(IModel<?> model) {
        super(model);
    }

    public ProgressPage(PageParameters parameters) {
        super(parameters);
    }
}
