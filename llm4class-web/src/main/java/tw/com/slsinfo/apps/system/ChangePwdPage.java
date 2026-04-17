package tw.com.slsinfo.apps.system;

import org.apache.wicket.model.IModel;
import org.apache.wicket.request.mapper.parameter.PageParameters;
import org.wicketstuff.annotation.mount.MountPath;
import tw.com.slsinfo.basic.BaseAppPage;

@Deprecated
@MountPath("/apps/changepwd")
public class ChangePwdPage extends BaseAppPage {
    public ChangePwdPage() {
    }

    public ChangePwdPage(IModel<?> model) {
        super(model);
    }

    public ChangePwdPage(PageParameters parameters) {
        super(parameters);
    }
}
