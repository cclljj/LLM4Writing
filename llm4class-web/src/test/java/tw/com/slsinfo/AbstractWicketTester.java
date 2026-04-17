package tw.com.slsinfo;


import org.apache.wicket.util.tester.WicketTester;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.wicketstuff.javaee.injection.JavaEEComponentInjector;
import tw.com.slsinfo.essayai.databases.mysql.MySqlCrudServiceImpl;
import tw.com.slsinfo.essayai.repositories.LogsRepositoryImpl;
import tw.com.slsinfo.essayai.repositories.RoleUserRepositoryImpl;
import tw.com.slsinfo.essayai.repositories.SchoolRepositoryImpl;
import tw.com.slsinfo.essayai.repositories.UserAccountRepositoryImpl;

import javax.naming.InitialContext;
import javax.naming.NamingException;

import static org.mockito.Mockito.mock;

/**
 * Custom Wicket Tester
 */
class AbstractWicketTester {
    private WicketTester tester;
    private InitialContext initialContext;

    public WicketTester getTester() {
        return tester;
    }

    @BeforeEach
    void setUp() {
        initJndi();
        //Creates a new WicketTester
        tester = new WicketTester(WicketApplicationHelper.createSignedInAsUserApplication());
        //Configures the SpringBean annotation support to use the mock application context.
        tester.getApplication().getComponentInstantiationListeners().add(new JavaEEComponentInjector(tester.getApplication()));
    }


    /**
     * creates Jndi environment
     *
     * @throws NamingException
     */
    private void initJndi() {
        try {
            initialContext = new InitialContext();
            initialContext.bind("java:comp/env/SchoolRepositoryImpl", mock(SchoolRepositoryImpl.class));
            initialContext.bind("java:comp/env/UserAccountRepositoryImpl", mock(UserAccountRepositoryImpl.class));
            initialContext.bind("java:comp/env/LogsRepositoryImpl", mock(LogsRepositoryImpl.class));
            initialContext.bind("java:comp/env/RoleUserRepositoryImpl", mock(RoleUserRepositoryImpl.class));
            initialContext.bind("java:comp/env/MySqlCrudServiceImpl", mock(MySqlCrudServiceImpl.class));


        } catch (NamingException e) {
            throw new RuntimeException(e);
        }
    }

    @AfterEach
    void afterAll() {
        try {
            initialContext.close();
        } catch (NamingException e) {
            throw new RuntimeException(e);
        }
    }
}
