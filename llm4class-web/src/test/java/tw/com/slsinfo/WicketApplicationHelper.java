package tw.com.slsinfo;

import com.unboundid.ldap.sdk.LDAPConnection;
import org.apache.wicket.Session;
import org.apache.wicket.authroles.authorization.strategies.role.Roles;
import org.apache.wicket.cdi.CdiConfiguration;
import org.apache.wicket.coep.CrossOriginEmbedderPolicyConfiguration;
import org.apache.wicket.coop.CrossOriginOpenerPolicyConfiguration;
import org.apache.wicket.markup.head.filter.JavaScriptFilteredIntoFooterHeaderResponse;
import org.apache.wicket.markup.html.IPackageResourceGuard;
import org.apache.wicket.markup.html.SecurePackageResourceGuard;
import org.apache.wicket.request.Request;
import org.apache.wicket.request.Response;
import org.apache.wicket.request.cycle.IRequestCycleListener;
import org.apache.wicket.request.cycle.RequestCycle;
import org.apache.wicket.request.http.WebResponse;
import org.apache.wicket.resource.JQueryResourceReference;
import org.apache.wicket.settings.RequestCycleSettings;
import org.mockito.Mockito;
import org.wicketstuff.annotation.scan.AnnotatedMountScanner;
import org.wicketstuff.javaee.injection.JavaEEComponentInjector;
import tw.com.slsinfo.essayai.authorization.SLSRolesAuthorizationStrategy;
import tw.com.slsinfo.noheader.InternalErrorPage;

import static org.apache.wicket.csp.CSPDirective.*;
import static org.apache.wicket.csp.CSPDirectiveSrcValue.*;

/**
 * Application Tester Helper
 * singleton
 * https://www.baeldung.com/java-mockito-singleton
 */
public class WicketApplicationHelper {

    public static LDAPConnection ldapConnection;

    public static WicketApplication createSignedInAsUserApplication() {


        return new WicketApplication() {


            @Override
            public void init() {

                getMarkupSettings().setDefaultMarkupEncoding("UTF-8");
                getRequestCycleSettings().setRenderStrategy(RequestCycleSettings.RenderStrategy.ONE_PASS_RENDER);
                getHeaderResponseDecorators().add(response -> new JavaScriptFilteredIntoFooterHeaderResponse(response, "footer-container"));
                getRequestCycleListeners().add(new IRequestCycleListener() {

                    @Override
                    public void onEndRequest(RequestCycle cycle) {
                        WebResponse response = (WebResponse) cycle.getResponse();
                        response.setHeader("X-XSS-Protection", "1; mode=block");
                        response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
                        response.setHeader("X-Content-Type-Options", "nosniff");
//                response.setHeader("X-Frame-Options", "sameorigin");
                    }
                });

                getSecuritySettings().setCrossOriginOpenerPolicyConfiguration(CrossOriginOpenerPolicyConfiguration.CoopMode.SAME_ORIGIN);
                getSecuritySettings().setCrossOriginEmbedderPolicyConfiguration(CrossOriginEmbedderPolicyConfiguration.CoepMode.ENFORCING);

                getCspSettings().blocking().clear().add(CONNECT_SRC, SELF)
                        .add(MANIFEST_SRC, SELF)
                        .add(CHILD_SRC, SELF)
                        .add(BASE_URI, SELF)
                        .add(OBJECT_SRC, SELF)
                        .add(FONT_SRC, "'self'", "https://fonts.gstatic.com/", "https://fonts.googleapis.com", "data:")
                        .add(SCRIPT_SRC, STRICT_DYNAMIC, NONCE)
                        .add(STYLE_SRC, SELF).add(STYLE_SRC, "https://fonts.googleapis.com")
                        .add(IMG_SRC, "'self'", "https://www.gstatic.com", "data:")
                        .add(FRAME_ANCESTORS, SELF)
                        .add(FORM_ACTION, SELF)
                        .add(DEFAULT_SRC, SELF);

                AnnotatedMountScanner scanner = new AnnotatedMountScanner();
                scanner.scanPackage("tw.com.slsinfo.*").mount(this);

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
                //Injector.get().inject(this);

                //Weld CDI
                //new CdiConfiguration().configure(this);
                // 建立 mock 的 CdiConfiguration
                CdiConfiguration mockCdiConfig = Mockito.mock(CdiConfiguration.class);
                // Do nothing when configure() is called
                Mockito.doNothing().when(mockCdiConfig).configure(Mockito.any());

                getJavaScriptLibrarySettings().setJQueryReference(JQueryResourceReference.getV3());

                //以下兩行加入後會進行DB頁面授權
                getSecuritySettings().setAuthorizationStrategy(new SLSRolesAuthorizationStrategy(this));
                getSecuritySettings().setUnauthorizedComponentInstantiationListener(this);

                getApplicationSettings().setInternalErrorPage(InternalErrorPage.class);
            }

            @Override
            public Session newSession(Request request, Response response) {

                return new WicketSession(request) {

                    @Override
                    public Roles getRoles() {
                        Roles resultRoles = new Roles();
                        resultRoles.add(Roles.USER);
                        resultRoles.add("系統管理者");
                        return resultRoles;
                    }

                    @Override
                    protected boolean authenticate(String email, String password) {
                        return true;
                    }
                };

            }


        };

    }

}
