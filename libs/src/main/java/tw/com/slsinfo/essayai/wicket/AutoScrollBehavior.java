package tw.com.slsinfo.essayai.wicket;

import org.apache.wicket.Component;
import org.apache.wicket.behavior.Behavior;
import org.apache.wicket.markup.head.IHeaderResponse;
import org.apache.wicket.markup.head.OnDomReadyHeaderItem;


/**
 * 聊天視窗自動捲動至最新發言位置
 */
public class AutoScrollBehavior extends Behavior {
    @Override
    public void bind(Component component) {
        component.setOutputMarkupId(true);
    }

    @Override
    public void renderHead(Component c, IHeaderResponse response) {
        String js = ";$('html,body')" +
                "  .stop(true)" +
                "  .animate({ scrollTop: $('#" + c.getMarkupId() + "').offset().top }, 300);";
        response.render(OnDomReadyHeaderItem.forScript(js));
    }
}
