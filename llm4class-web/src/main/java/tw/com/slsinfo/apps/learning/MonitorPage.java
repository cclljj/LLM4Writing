package tw.com.slsinfo.apps.learning;

import org.apache.wicket.model.IModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;

@MountPath("/apps/monitor")
public class MonitorPage extends BaseAppPage {
    public MonitorPage() {
    }

    public MonitorPage(IModel<?> model) {
        super(model);
    }

    public MonitorPage(PageParameters parameters) {
        super(parameters);
    }
}
