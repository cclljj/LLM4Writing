package tw.com.slsinfo.essayai.authorization;

import jakarta.ejb.EJB;
import org.apache.wicket.Component;
import org.apache.wicket.authorization.Action;
import org.apache.wicket.authroles.authorization.strategies.role.IRoleCheckingStrategy;
import org.apache.wicket.authroles.authorization.strategies.role.Roles;
import org.apache.wicket.injection.Injector;
import org.apache.wicket.request.component.IRequestableComponent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.Rolepermission;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.commons.wicket.authorization.AbstractExternalDataStoreRoleAuthorizationStrategy;


import java.util.ArrayList;
import java.util.List;


/**
 * 從資料庫讀取角色對應可使用元件授權
 */
public class RDBRoleAuthorizationStrategy extends AbstractExternalDataStoreRoleAuthorizationStrategy {

    private static final Logger logger = LoggerFactory.getLogger(RDBRoleAuthorizationStrategy.class);

    /**
     * 從資料庫中讀取Role對應的元件類別名稱
     */
    @EJB(name = "MySqlCrudServiceImpl")
    private IRDBCrudService<Rolepermission> rolepermissionIRDBCrudService;

    public RDBRoleAuthorizationStrategy(IRoleCheckingStrategy roleCheckingStrategy) {
        super(roleCheckingStrategy);
        Injector.get().inject(this);
    }

    @Override
    protected <T extends IRequestableComponent> Roles rolesAuthorizedToInstantiate(Class<T> aClass) {
        logger.debug("Component Name : {}", aClass.getSimpleName());
        List<String> roleslist = new ArrayList<>();
        rolepermissionIRDBCrudService.findWithNamedQuery(
                        NamedQueryNames.FIND_ROLE_BY_COMPONENTCLASSNAME,
                        QueryParameterBuilder.start("component", aClass.getSimpleName()).build())
                .forEach(rp -> {
                    logger.debug("Permission : {}", rp.getRid().getName());
                    roleslist.add(rp.getRid().getName());
                });

        if (roleslist.isEmpty()) {
            if (logger.isDebugEnabled()) {
                logger.debug("No roles found");
            }
            return null;
        } else {
            if (logger.isDebugEnabled()) {
                logger.debug("Roles : {}", roleslist);
            }
            return new Roles(roleslist);
        }
    }

    @Override
    protected Roles rolesAuthorizedToPerformAction(Component component, Action action) {
        return null;
    }
}
