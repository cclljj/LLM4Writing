package tw.com.slsinfo.modal.course;


import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.wicket.ajax.AbstractDefaultAjaxBehavior;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.core.request.handler.IPartialPageRequestHandler;
import org.apache.wicket.markup.head.CssHeaderItem;
import org.apache.wicket.markup.head.IHeaderResponse;
import org.apache.wicket.markup.head.JavaScriptHeaderItem;
import org.apache.wicket.markup.head.OnDomReadyHeaderItem;
import org.apache.wicket.model.IModel;
import org.apache.wicket.model.LoadableDetachableModel;
import org.apache.wicket.request.IRequestParameters;
import org.apache.wicket.request.cycle.RequestCycle;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.wicket.modal.BaseModal;
import tw.com.slsinfo.essayai.models.GenreType;
import tw.com.slsinfo.essayai.models.course.TreeModel;
import tw.com.slsinfo.essayai.utils.TreeUtils;

/**
 * GoJS Tree Modal
 */
public class TreeModal extends BaseModal<TreeModel> {
    private static final Logger logger = LoggerFactory.getLogger(TreeModal.class);

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private AbstractDefaultAjaxBehavior saveBehavior;
    private IModel<TreeModel> model;

    public TreeModal(String id, IModel<TreeModel> model) {
        super(id);
    }

    public TreeModal(String id) {
        super(id);
        model = () -> {
            TreeUtils treeUtils = new TreeUtils();
            TreeModel treeModel = new TreeModel();
            treeModel.setJson(treeUtils.buildTemplateJson(GenreType.EXPOSITORY, "科技進步對學習的影響"));
            return treeModel;
        };
    }

    private void init() {

        saveBehavior = new AbstractDefaultAjaxBehavior() {
            @Override
            protected void respond(AjaxRequestTarget target) {
                IRequestParameters params = RequestCycle.get().getRequest().getRequestParameters();
                String json = params.getParameterValue("json").toString();
                logger.debug("[ChartGo] 最新 JSON => \n{}", json);
            }
        };
        add(saveBehavior);

        AjaxLink<Void> btnClose = new AjaxLink<>("btnClose") {
            @Override
            public void onClick(AjaxRequestTarget target) {
                close(target);
            }
        };
        add(btnClose);
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        init();
    }

    @Override
    public void setModelObject(TreeModel treeModel) {
        super.setModelObject(treeModel);
        model.setObject(treeModel);
    }

    @Override
    public void show(IPartialPageRequestHandler partialPageRequestHandler) {
        super.show(partialPageRequestHandler);
    }

    @Override
    public void renderHead(IHeaderResponse response) {
        super.renderHead(response);

        response.render(JavaScriptHeaderItem.forUrl("/assets/js/go.js"));
        response.render(JavaScriptHeaderItem.forUrl("/assets/js/chartgo.js"));

        String css = ".goTXarea{background:#fff!important;border:1px solid #999!important;box-shadow:none!important;}"
                + "#myDiagramDiv{position:relative;}";
        response.render(CssHeaderItem.forCSS(css, "gojs-core-css"));

        CharSequence callbackUrl = saveBehavior.getCallbackUrl();

        // Pass as 'treeData' (array literal), avoiding any escaping pitfalls.
        String init =
                "ChartGo.init('myDiagramDiv', {\n" +
                        "  treeData: " + model.getObject().getJson() + ",\n" +   // <-- pass array directly (NOT as a quoted string)
                        "  callbackUrl: '" + callbackUrl + "',\n" +
                        "  levelColors: ['#C84C4C','#6F52B5','#36A9C5','#F2994A','#E3E8EF']\n" +
                        "});";

        response.render(OnDomReadyHeaderItem.forScript(init));
    }


}
