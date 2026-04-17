package tw.com.slsinfo.basic;


import com.openai.client.OpenAIClient;
import com.openai.client.OpenAIClientAsync;
import org.apache.wicket.markup.html.panel.Panel;
import org.apache.wicket.model.IModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.WicketApplication;
import tw.com.slsinfo.WicketSession;

import java.io.Serial;

public class BasePanel extends Panel {

    @Serial
    private static final long serialVersionUID = -613264248014794732L;

    private static final Logger logger = LoggerFactory.getLogger(BasePanel.class);

    public BasePanel(String id) {
        super(id);
    }

    public BasePanel(String id, IModel<?> model) {
        super(id, model);
    }


    /**
     * Get mlcnnweb application instance
     *
     * @return WicketApplication
     */
    protected WicketApplication getWicketApplication() {
        return (WicketApplication) getApplication();
    }


    /**
     * Get mlcnnweb session instance
     *
     * @return WicketSessions
     */
    protected WicketSession getWicketSession() {
        return (WicketSession) getSession();
    }

    /**
     * 是否已登入
     *
     * @return
     */
    protected boolean isSignedIn() {
        return getWicketSession().isSignedIn();
    }


    @Override
    protected void onInitialize() {
        super.onInitialize();
        getWicketSession().bind();
    }


    /**
     * Get LLM4Class Sync Client
     *
     * @return
     */
    public OpenAIClient getOpenAIClient() {
        return getWicketApplication().getOpenAIClient();
    }

    /**
     * Get LLM4Class Async Client
     *
     * @return
     */
    public OpenAIClientAsync getOpenAIClientAsync() {
        return getWicketApplication().getOpenAIClientAsync();
    }
}