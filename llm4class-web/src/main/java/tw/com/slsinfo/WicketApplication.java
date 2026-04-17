package tw.com.slsinfo;

import com.openai.client.OpenAIClient;
import com.openai.client.OpenAIClientAsync;
import jakarta.annotation.Resource;
import org.apache.wicket.authroles.authentication.AbstractAuthenticatedWebSession;
import org.apache.wicket.authroles.authentication.AuthenticatedWebApplication;
import org.apache.wicket.cdi.CdiConfiguration;
import org.apache.wicket.cdi.NonContextual;
import org.apache.wicket.coep.CrossOriginEmbedderPolicyConfiguration;
import org.apache.wicket.coop.CrossOriginOpenerPolicyConfiguration;
import org.apache.wicket.injection.Injector;
import org.apache.wicket.markup.head.filter.JavaScriptFilteredIntoFooterHeaderResponse;
import org.apache.wicket.markup.html.IPackageResourceGuard;
import org.apache.wicket.markup.html.SecurePackageResourceGuard;
import org.apache.wicket.markup.html.WebPage;
import org.apache.wicket.protocol.ws.WebSocketSettings;
import org.apache.wicket.resource.JQueryResourceReference;
import org.apache.wicket.settings.RequestCycleSettings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.wicketstuff.annotation.scan.AnnotatedMountScanner;
import org.wicketstuff.javaee.injection.JavaEEComponentInjector;
import tw.com.slsinfo.essayai.authorization.SLSRolesAuthorizationStrategy;
import tw.com.slsinfo.essayai.chatroom.SameClassMemberIndex;
import tw.com.slsinfo.essayai.openai.OpenAIApiClientSingleton;
import tw.com.slsinfo.essayai.utils.AIConstants;
import tw.com.slsinfo.noheader.AccessDenyPage;
import tw.com.slsinfo.noheader.InternalErrorPage;
import tw.com.slsinfo.noheader.SessionTimeoutPage;
import tw.com.slsinfo.signin.LoginPage;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.util.Properties;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ScheduledExecutorService;

import static org.apache.wicket.csp.CSPDirective.*;
import static org.apache.wicket.csp.CSPDirectiveSrcValue.*;

/**
 * Application object for your web application.
 * If you want to run this application without deploying, run the Start class.
 *
 * @see tw.com.slsinfo.Start#main(String[])
 */
public class WicketApplication extends AuthenticatedWebApplication {

    private static final Logger logger = LoggerFactory.getLogger(WicketApplication.class);

    @Resource(lookup = "java:comp/DefaultManagedScheduledExecutorService")
    //@Resource(name = "DefaultManagedScheduledExecutorService")
    private ScheduledExecutorService scheduler;

    @Resource(lookup = "java:comp/DefaultManagedExecutorService")
    private ExecutorService executorService;


    private SameClassMemberIndex sameClassMemberIndex;
    /**
     * OpenAI API Client Singleton
     */
    private OpenAIApiClientSingleton openAIApiClientSingleton = OpenAIApiClientSingleton.INSTANCE;

    private static final String vectorid = AIConstants.VECTOR_ID_LLM4CLASS;

    /**
     * @see org.apache.wicket.Application#getHomePage()
     */
    @Override
    public Class<? extends WebPage> getHomePage() {
        return HomePage.class;
    }

    /**
     * @see org.apache.wicket.Application#init()
     */
    @Override
    public void init() {
        super.init();

        getMarkupSettings().setDefaultMarkupEncoding("UTF-8");
        getRequestCycleSettings().setRenderStrategy(RequestCycleSettings.RenderStrategy.ONE_PASS_RENDER);
        getHeaderResponseDecorators().add(response -> new JavaScriptFilteredIntoFooterHeaderResponse(response, "footer-container"));
//        getRequestCycleListeners().add(new IRequestCycleListener() {
//
//            @Override
//            public void onEndRequest(RequestCycle cycle) {
//                WebResponse response = (WebResponse) cycle.getResponse();
//                response.setHeader("X-XSS-Protection", "1; mode=block");
//                response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
//                response.setHeader("X-Content-Type-Options", "nosniff");
//            }
//        });

        getSecuritySettings().setCrossOriginOpenerPolicyConfiguration(CrossOriginOpenerPolicyConfiguration.CoopMode.SAME_ORIGIN);
        getSecuritySettings().setCrossOriginEmbedderPolicyConfiguration(CrossOriginEmbedderPolicyConfiguration.CoepMode.ENFORCING);

        getCspSettings().blocking().clear().add(CONNECT_SRC, SELF.getValue(), "https://llm4class.teliclab.info")
                .add(MANIFEST_SRC, SELF)
                .add(CHILD_SRC, SELF)
                .add(BASE_URI, SELF)
                .add(OBJECT_SRC, SELF)
                .add(FONT_SRC, "'self'", "https://fonts.gstatic.com/", "https://fonts.googleapis.com", "data:")
                .add(SCRIPT_SRC, STRICT_DYNAMIC, NONCE)
                .add(STYLE_SRC, SELF)
                .add(STYLE_SRC, UNSAFE_INLINE)
                .add(STYLE_SRC, "https://fonts.googleapis.com")
                .add(IMG_SRC, "'self'", "https://www.gstatic.com", "data:")
                .add(FRAME_ANCESTORS, SELF)
                .add(FORM_ACTION, SELF)
                .add(DEFAULT_SRC, SELF);

        AnnotatedMountScanner scanner = new AnnotatedMountScanner();
        scanner.scanPackage("tw.com.slsinfo").mount(this);
        scanner.scanPackage("tw.com.slsinfo.basic").mount(this);
        scanner.scanPackage("tw.com.slsinfo.noheader").mount(this);
        scanner.scanPackage("tw.com.slsinfo.signin").mount(this);
        scanner.scanPackage("tw.com.slsinfo.course").mount(this);
        scanner.scanPackage("tw.com.slsinfo.apps.*").mount(this);

        IPackageResourceGuard packageResourceGuard = getResourceSettings().getPackageResourceGuard();
        if (packageResourceGuard instanceof SecurePackageResourceGuard) {
            SecurePackageResourceGuard securePackageResourceGuard = (SecurePackageResourceGuard) packageResourceGuard;
            securePackageResourceGuard.addPattern("+*.woff");
            securePackageResourceGuard.addPattern("+*.woff2");
            securePackageResourceGuard.addPattern("+*.ttf");
            securePackageResourceGuard.addPattern("+*.eot");
            securePackageResourceGuard.addPattern("+*.scss");
            securePackageResourceGuard.addPattern("-*jquery-2*.js");
            securePackageResourceGuard.addPattern("-*jquery-1*.js");
        }

        //Jakarta EE Injection
        getComponentInstantiationListeners().add(new JavaEEComponentInjector(this));
        //Application使用EJB必須加入此行
        Injector.get().inject(this);

        //Weld CDI
        new CdiConfiguration().configure(this);

        //Non-Contextual
        NonContextual.of(WicketApplication.class).inject(this);
        getJavaScriptLibrarySettings().setJQueryReference(JQueryResourceReference.getV3());

        //以下兩行加入後會進行DB頁面授權
        getSecuritySettings().setAuthorizationStrategy(new SLSRolesAuthorizationStrategy(this));
        getSecuritySettings().setUnauthorizedComponentInstantiationListener(this);

        getApplicationSettings().setInternalErrorPage(InternalErrorPage.class);
        getApplicationSettings().setPageExpiredErrorPage(SessionTimeoutPage.class);
        getApplicationSettings().setAccessDeniedPage(AccessDenyPage.class);

        final WebSocketSettings webSocketSettings = WebSocketSettings.Holder.get(this);

        // use asynchronous/non-blocking push mode
        webSocketSettings.setAsynchronousPush(true);
        //webSocketSettings.setAsynchronousPushTimeout(6000L);

        webSocketSettings.setSocketSessionConfigurer(webSocketSession -> {
            // use 5 minutes idle timeout
            webSocketSession.setMaxIdleTimeout(Duration.ofMinutes(10).toMillis());
        });
    }


    @Override
    protected Class<? extends AbstractAuthenticatedWebSession> getWebSessionClass() {
        return WicketSession.class;
    }

    @Override
    protected Class<? extends WebPage> getSignInPageClass() {
        return LoginPage.class;
    }

    public ScheduledExecutorService getScheduledExecutorService() {
        return scheduler;
    }

    /**
     * Get LLM4Class Sync Client
     *
     * @return
     */
    public OpenAIClient getOpenAIClient() {
        return openAIApiClientSingleton.getOpenAIClient(AIConstants.RemoteLLM4ClassFolder, executorService,Duration.ofSeconds(30));
    }

    /**
     * Get LLM4Class Async Client
     *
     * @return
     */
    public OpenAIClientAsync getOpenAIClientAsync() {
        return openAIApiClientSingleton.getOpenAIClientAsync(AIConstants.RemoteLLM4ClassFolder, executorService,Duration.ofSeconds(30));
    }


    /**
     * Group Chat Client holder
     *
     * @return
     */
    public SameClassMemberIndex getChatGroupIndex() {
        return sameClassMemberIndex;
    }

    /**
     * OpenAI VectorId
     *
     * @return
     */
    public String getVectorId() {
        return vectorid;
    }

    /**
     * 載入版本號屬性檔
     *
     * @return
     */
    public String loadRevisionString() {

        Properties prop = new Properties();
        StringBuilder stringBuffer = new StringBuilder();
        try (InputStream stream = getClass().getResourceAsStream("/build.properties")) {
            prop.load(stream);
            String version = prop.getProperty("version");
            String timestamp = prop.getProperty("timestamp").substring(0, 10).replace("-", "");
            String revision = prop.getProperty("revision");
            stringBuffer.append(timestamp).append(".").append(revision);
        } catch (IOException e) {
            logger.debug(e.getMessage());
        }
        return stringBuffer.toString();

    }
}
