package tw.com.slsinfo.essayai.authorization;

import org.apache.wicket.authorization.strategies.CompoundAuthorizationStrategy;
import org.apache.wicket.authroles.authorization.strategies.role.IRoleCheckingStrategy;
import org.apache.wicket.authroles.authorization.strategies.role.annotations.AnnotationsRoleAuthorizationStrategy;
import org.apache.wicket.authroles.authorization.strategies.role.metadata.MetaDataRoleAuthorizationStrategy;


/**
 * 整合內建兩種RoleAuthorizationStratege再加上自訂的DB來源AuthorizationStrategy
 */
public class SLSRolesAuthorizationStrategy extends CompoundAuthorizationStrategy {
    /**
     * Construct.
     *
     * @param roleCheckingStrategy the role checking strategy
     */
    public SLSRolesAuthorizationStrategy(final IRoleCheckingStrategy roleCheckingStrategy) {
        add(new AnnotationsRoleAuthorizationStrategy(roleCheckingStrategy));
        add(new MetaDataRoleAuthorizationStrategy(roleCheckingStrategy));
        add(new RDBRoleAuthorizationStrategy(roleCheckingStrategy));
    }
}
