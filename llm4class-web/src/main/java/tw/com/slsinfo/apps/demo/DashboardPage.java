package tw.com.slsinfo.apps.demo;

import org.apache.wicket.model.IModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;

@MountPath("/apps/dashboard")
public class DashboardPage extends BaseAppPage {
    public DashboardPage() {
    }

    public DashboardPage(IModel<?> model) {
        super(model);
    }

    public DashboardPage(PageParameters parameters) {
        super(parameters);
    }


}
