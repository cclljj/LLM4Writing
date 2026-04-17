package tw.com.slsinfo.model.course;

import org.apache.wicket.markup.ComponentTag;
import org.apache.wicket.markup.html.form.CheckBoxMultipleChoice;
import org.apache.wicket.markup.html.form.IChoiceRenderer;
import org.apache.wicket.model.IModel;
import org.apache.wicket.request.Request;
import org.apache.wicket.util.string.AppendingStringBuffer;

import java.util.ArrayList;
import java.util.List;

public class CustomCheckBoxMultipleChoice<T> extends CheckBoxMultipleChoice<T> {

    private String uniquePrefix;

    public CustomCheckBoxMultipleChoice(String id, IModel<? extends List<T>> choices,
                                        IChoiceRenderer<? super T> renderer, String uniquePrefix) {
        super(id, choices, renderer);
        this.uniquePrefix = uniquePrefix;
    }

    public CustomCheckBoxMultipleChoice(String id, IModel<? extends List<T>> model,
                                        IModel<? extends List<T>> choices,
                                        IChoiceRenderer<? super T> renderer, String uniquePrefix) {
        super(id, model, choices, renderer);
        this.uniquePrefix = uniquePrefix;
    }

    @Override
    protected void appendOptionHtml(AppendingStringBuffer buffer, T choice, int index, String selected) {
        Object displayValue = getChoiceRenderer().getDisplayValue(choice);

        // 產生唯一的 ID 和 name
        String choiceId = generateChoiceMarkupId(choice, index);
        String uniqueName = uniquePrefix + "_choice_" + index;

        buffer.append("<input name=\"").append(uniqueName).append("\"")
                .append(" type=\"checkbox\"")
                .append((selected != null ? " checked=\"checked\"" : ""))
                .append(" value=\"").append(getChoiceRenderer().getIdValue(choice, index)).append("\"")
                .append(" id=\"").append(choiceId).append("\"");

        // 添加 data 屬性來標識這是哪個組件的選項
        buffer.append(" data-component=\"").append(getMarkupId()).append("\"");

        buffer.append(">");

        // 標籤
//        CharSequence display = getDisplayValue(displayValue);
//        buffer.append("<label for=\"").append(choiceId).append("\">")
//                .append(display)
//                .append("</label>");
    }

    // 自定義方法生成唯一的 markup ID
    protected String generateChoiceMarkupId(T choice, int index) {
        return getMarkupId() + "_" + uniquePrefix + "_choice_" + index;
    }

    @Override
    public void updateModel() {
        // 自定義模型更新邏輯
        List<T> selectedChoices = new ArrayList<>();
//        List<T> allChoices = getChoices();
//
//        if (allChoices != null && !allChoices.isEmpty()) {
//            Request request = getRequest();
//
//            // 檢查每個選項是否被選中
//            for (int i = 0; i < allChoices.size(); i++) {
//                String paramName = uniquePrefix + "_choice_" + i;
//                String[] values = request.getParameterValues(paramName);
//
//                if (values != null && values.length > 0) {
//                    T choice = allChoices.get(i);
//                    String expectedValue = getChoiceRenderer().getIdValue(choice, i);
//
//                    // 檢查值是否匹配
//                    for (String value : values) {
//                        if (expectedValue.equals(value)) {
//                            selectedChoices.add(choice);
//                            break;
//                        }
//                    }
//                }
//            }
//        }
//
//        // 更新模型
//        setModelObject(selectedChoices);
    }
}
