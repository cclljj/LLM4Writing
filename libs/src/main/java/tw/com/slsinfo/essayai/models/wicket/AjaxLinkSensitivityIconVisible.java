package tw.com.slsinfo.essayai.models.wicket;

import org.apache.wicket.Component;
import org.apache.wicket.ajax.AjaxRequestTarget;
import org.apache.wicket.ajax.markup.html.AjaxLink;
import org.apache.wicket.markup.html.WebMarkupContainer;

public class AjaxLinkSensitivityIconVisible extends AjaxLink<Void> {

    private static final long serialVersionUID = 1L;

    private String content;

    private Component targetLabel;

    private WebMarkupContainer icon;

    private int invisibleCount = 4;

    public AjaxLinkSensitivityIconVisible(String id, String content, Component targetLabel) {
        super(id);
        this.targetLabel = targetLabel;
        this.content = content;
    }

    public AjaxLinkSensitivityIconVisible(String id, String content, Component targetLabel, int invisibleCount) {
        super(id);
        this.content = content;
        this.targetLabel = targetLabel;
        this.invisibleCount = invisibleCount;
    }

    @Override
    protected void onInitialize() {
        super.onInitialize();
        icon = new WebMarkupContainer("icon");
        icon.setOutputMarkupId(true);
        add(icon);
    }

    public String getMask() {
        if (content == null || content.isEmpty()) {
            return "";
        }

        if (invisibleCount < 0 || invisibleCount >= content.length()) {
            return "•".repeat(content.length());
        }

        return content.substring(0, content.length() - invisibleCount) + "•".repeat(invisibleCount);
    }

    @Override
    public void onClick(AjaxRequestTarget ajaxRequestTarget) {
        String labelId = targetLabel.getMarkupId();
        String iconId = icon.getMarkupId();
        ajaxRequestTarget.appendJavaScript(
                "(() => {\n" +
                        "  const el = document.getElementById('" + labelId + "');\n" +
                        "  const icon = document.getElementById('" + iconId + "');\n" +
                        "  const plain = el.dataset.secureText || \"\";\n" +
                        "  const invisibleCount = " + invisibleCount + ";\n" +
                        "  let isVisible = el.dataset.visible === \"true\";\n" +
                        "  isVisible = !isVisible; \n" +
                        "  let masked = \"\";\n" +
                        "  if (!isVisible) {\n" +
                        "      masked = \"" + getMask() + "\";\n" +
                        "  } else {\n" +
                        "    masked = \"" + content + "\";\n " +
                        "  }\n" +
                        "  el.textContent = masked;\n" +
                        "  el.dataset.visible = isVisible.toString();\n" +
                        "  icon.classList.toggle('fe-eye');\n" +
                        "  icon.classList.toggle('fe-eye-off');\n" +
                        "})();"
        );
    }

}
