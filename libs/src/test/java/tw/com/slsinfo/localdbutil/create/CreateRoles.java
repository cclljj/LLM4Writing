package tw.com.slsinfo.localdbutil.create;

import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.essayai.databases.mysql.entities.Role;
import tw.com.slsinfo.essayai.databases.mysql.entities.Title;
import tw.com.slsinfo.localdbutil.LocalMySQLCrudServiceImpl;

import java.util.List;

/**
 * 初始化色角
 */
public class CreateRoles {
    public static void main(String[] args) {

        List<String> roles
                = List.of("教師", "學生", "系統管理者", "研究人員");
        IRDBCrudService<Role> roleIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        roles.forEach(role -> {
            Role r = new Role();
            r.setName(role);
            roleIRDBCrudService.create(r);
        });
    }
}
