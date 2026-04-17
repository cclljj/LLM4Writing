package tw.com.slsinfo.essayai.models.wicket;

import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.markup.html.basic.Label;

public class AjaxLinkSensitivityVisible extends AjaxLink<Void> {

    private static final long serialVersionUID = 1L;

    private boolean visible;

    private String targetName;

    private int invisibleCount = 4;

    public AjaxLinkSensitivityVisible(String id, String targetName) {
        super(id);
        this.visible = false;
        this.targetName = targetName;
    }

    public AjaxLinkSensitivityVisible(String id, boolean visible, String targetName) {
        super(id);
        this.visible = visible;
        this.targetName = targetName;
    }


    @Override
    protected void onInitialize() {
        super.onInitialize();
//        add(new Label("status", targetName.contains(visible ? "顯示" : "隱藏")));
        add(new Label("status", targetName.concat("顯示/隱藏")));
    }

    @Override
    public void onClick(AjaxRequestTarget ajaxRequestTarget) {
        ajaxRequestTarget.appendJavaScript(
                "document.querySelectorAll(\".secure-text\").forEach(value => {\n" +
                        "  const plain = value.dataset.secureText || \"\";\n" +
                        "  let isVisible = value.dataset.visible === \"true\";\n" +
                        "  const invisibleCount = " + invisibleCount + ";\n" +
                        "  isVisible = !isVisible; \n" +
                        "  let masked = \"\";\n" +
                        "  if (!isVisible) {\n" +
                        "    if (invisibleCount < 0 || invisibleCount >= plain.length) {\n" +
                        "      masked = \"•\".repeat(plain.length);\n" +
                        "    } else {\n" +
                        "       masked = plain.substring(0, plain.length - invisibleCount) + \"•\".repeat(invisibleCount);\n"+
                        "    }\n" +
                        "  } else {\n" +
                        "    masked = plain;\n" +
                        "  }\n" +
                        "  value.textContent = masked;\n" +
                        "  value.dataset.visible = isVisible.toString();\n" +
                        "});"
        );

    }
}
