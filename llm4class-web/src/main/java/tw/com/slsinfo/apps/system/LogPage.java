package tw.com.slsinfo.apps.system;

import org.apache.wicket.model.IModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;

@MountPath("/apps/logs")
public class LogPage extends BaseAppPage {
    public LogPage() {
    }

    public LogPage(IModel<?> model) {
        super(model);
    }

    public LogPage(PageParameters parameters) {
        super(parameters);
    }
}
