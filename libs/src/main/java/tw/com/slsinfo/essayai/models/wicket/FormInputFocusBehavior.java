package tw.com.slsinfo.essayai.models.wicket;

import org.apache.wicket.Component;
import org.apache.wicket.behavior.Behavior;
import org.apache.wicket.markup.head.IHeaderResponse;
import org.apache.wicket.markup.head.OnDomReadyHeaderItem;

/**
 * Focus on form inputs
 */
public class FormInputFocusBehavior extends Behavior {

    public FormInputFocusBehavior() {
    }

    @Override
    public void renderHead(Component component, IHeaderResponse response) {
        super.renderHead(component, response);
        response.render(OnDomReadyHeaderItem.forScript(
                ";$('#" + component.getMarkupId() + "').focus();"
        ));
    }
}
