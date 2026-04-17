package tw.com.slsinfo.essayai.modals;

import org.apache.wicket.AttributeModifier;
import org.apache.wicket.core.request.handler.IPartialPageRequestHandler;
import org.apache.wicket.markup.html.TransparentWebMarkupContainer;
import org.apache.wicket.markup.html.WebMarkupContainer;
import org.apache.wicket.markup.html.panel.Panel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public abstract class MyBaseModal<T> extends Panel {

    private static final Logger logger = LoggerFactory.getLogger(MyBaseModal.class);
    private static final long serialVersionUID = -390882902668214827L;
    private String initialModalSize = MyModalSize.LG.getValue();
    private WebMarkupContainer container, dialog;

    public MyBaseModal(String id) {
        super(id);
    }

    /**
     * 設定 Modal 大小
     *
     * @param initialModalSize
     * @return
     */
    public MyBaseModal setInitialModalSize(final MyModalSize initialModalSize) {
        this.initialModalSize = initialModalSize.getValue();
        return this;
    }

    /**
     * 設定 Modal 大小，傳入Bootstrap class name
     *
     * @param initialModalSize
     * @return
     */
    public MyBaseModal setInitialModalSize(final String initialModalSize) {
        this.initialModalSize = initialModalSize;
        return this;
    }


    @Override
    protected void onInitialize() {
        super.onInitialize();

        container = new TransparentWebMarkupContainer("modal");
        container.setOutputMarkupId(true);

        dialog = new TransparentWebMarkupContainer("dialog");
        dialog.add(new AttributeModifier("class", initialModalSize));
        dialog.setOutputMarkupId(true);

        container.add(dialog);
        add(container);
    }

    /**
     * 關閉 Modal
     *
     * @param partialPageRequestHandler
     */
    public void close(IPartialPageRequestHandler partialPageRequestHandler) {
        partialPageRequestHandler.appendJavaScript("$(function () {\n" +
                "   $('#" + container.getMarkupId() + "').modal('hide');}); \n" +
                "$('#" + container.getMarkupId() + "').on('hidden.bs.modal')");
    }

    /**
     * 開啟 Modal
     *
     * @param partialPageRequestHandler
     */
    public void show(IPartialPageRequestHandler partialPageRequestHandler) {
        partialPageRequestHandler.appendJavaScript("$(function () {\n" +
                "   $('#" + container.getMarkupId() + "').modal('show');}); \n" +
                "$('#" + container.getMarkupId() + "').on('shown.bs.modal')");

    }

    /**
     * Modal CWAResponse
     *
     * @param t                          物件
     * @param iPartialPageRequestHandler
     */
    protected void onResponse(T t, IPartialPageRequestHandler iPartialPageRequestHandler) {
        close(iPartialPageRequestHandler);
    }


    /**
     * 設定變數
     *
     * @param t
     */
    public void setModelObject(T t) {

    }

}
