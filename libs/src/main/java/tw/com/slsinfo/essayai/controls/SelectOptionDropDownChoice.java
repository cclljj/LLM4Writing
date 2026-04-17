package tw.com.slsinfo.essayai.controls;

import org.apache.wicket.markup.html.form.ChoiceRenderer;
import org.apache.wicket.markup.html.form.DropDownChoice;
import org.apache.wicket.markup.html.form.IChoiceRenderer;
import org.apache.wicket.model.IModel;
import org.apache.wicket.util.convert.IConverter;
import org.apache.wicket.util.convert.ConversionException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.models.SelectOption;

import java.util.List;
import java.util.Locale;

public abstract class SelectOptionDropDownChoice extends DropDownChoice<SelectOption> {

    private static final Logger logger = LoggerFactory.getLogger(SelectOptionDropDownChoice.class);
    private List<SelectOption> optionsList; // 保存選項列表的引用

    public SelectOptionDropDownChoice(boolean required, String id, List<SelectOption> list) {
        super(id);
        this.optionsList = list; // 保存列表引用
        init(required, list);
    }

    public void init(boolean required, List<SelectOption> list) {
        setChoices(list);
        setOutputMarkupId(true);
        setRequired(required);

        // 設定自定義的 ChoiceRenderer
        setChoiceRenderer(new SelectOptionChoiceRenderer(list));
        setDefault();
    }

    /**
     * 自定義的 ChoiceRenderer 類別
     */
    private class SelectOptionChoiceRenderer extends ChoiceRenderer<SelectOption> {
        private final List<SelectOption> choices;

        public SelectOptionChoiceRenderer(List<SelectOption> choices) {
            this.choices = choices;
        }

        @Override
        public Object getDisplayValue(SelectOption selectOption) {
            return selectOption != null ? selectOption.getLabel() : "";
        }

        @Override
        public String getIdValue(SelectOption selectOption, int index) {
            return selectOption != null ? selectOption.getValue() : String.valueOf(index);
        }

        @Override
        public SelectOption getObject(String id, IModel<? extends List<? extends SelectOption>> choicesModel) {
            logger.debug("ChoiceRenderer.getObject 被呼叫，id: {}", id);

            if (id == null || id.isEmpty()) {
                logger.debug("id 為 null 或空字串，返回 null");
                return null;
            }

            // 優先使用 choicesModel 中的選項列表
            List<? extends SelectOption> modelChoices = null;
            if (choicesModel != null) {
                modelChoices = choicesModel.getObject();
            }

            // 如果 model 為空，使用保存的選項列表
            if (modelChoices == null || modelChoices.isEmpty()) {
                modelChoices = choices;
            }

            // 如果還是為空，使用類別層級的選項列表
            if (modelChoices == null || modelChoices.isEmpty()) {
                modelChoices = optionsList;
            }

            if (modelChoices != null) {
                SelectOption result = modelChoices.stream()
                        .filter(option -> option != null && id.equals(option.getValue()))
                        .findFirst()
                        .orElse(null);

                logger.debug("根據 id: {} 找到的選項: {}", id, result);
                return result;
            }

            logger.debug("找不到對應的選項，id: {}", id);
            return null;
        }
    }

    /**
     * 提供自定義的 Converter 來處理 String 與 SelectOption 之間的轉換
     */
    @Override
    public <C> IConverter<C> getConverter(Class<C> type) {
        if (SelectOption.class.isAssignableFrom(type)) {
            return (IConverter<C>) new SelectOptionConverter();
        }
        return super.getConverter(type);
    }

    /**
     * 自定義的轉換器
     */
    private class SelectOptionConverter implements IConverter<SelectOption> {

        @Override
        public SelectOption convertToObject(String value, Locale locale) throws ConversionException {
            logger.debug("convertToObject 被呼叫，value: {}", value);

            if (value == null || value.isEmpty()) {
                return null;
            }

            // 使用 ChoiceRenderer 來轉換
            IChoiceRenderer<? super SelectOption> renderer = getChoiceRenderer();
            if (renderer != null) {
                SelectOption result = (SelectOption) renderer.getObject(value, getChoicesModel());
                logger.debug("convertToObject 結果: {}", result);
                return result;
            }

            // 備用方案：直接在選項列表中查找
            if (optionsList != null) {
                SelectOption result = optionsList.stream()
                        .filter(option -> option != null && value.equals(option.getValue()))
                        .findFirst()
                        .orElse(null);
                logger.debug("備用轉換結果: {}", result);
                return result;
            }

            logger.warn("無法轉換值: {}", value);
            return null;
        }

        @Override
        public String convertToString(SelectOption value, Locale locale) {
            if (value != null) {
                String result = value.getValue();
                logger.debug("convertToString 返回: {}", result);
                return result;
            }
            logger.debug("convertToString 返回 null");
            return null;
        }
    }

    /**
     * 確保模型值正確處理
     */
    @Override
    public String getModelValue() {
        SelectOption object = getModelObject();
        if (object != null) {
            String value = object.getValue();
            logger.debug("getModelValue 返回: {}", value);
            return value;
        }
        logger.debug("getModelValue 返回空字串");
        return "";
    }

    /**
     * 給於預設
     */
    protected void setDefault() {
        // 子類可以覆寫此方法來設定預設值
    }

    public abstract SelectOption getObject(String id, IModel<? extends List<? extends SelectOption>> choices);
}