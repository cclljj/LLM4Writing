package tw.com.slsinfo.localdbutil.create;

import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.essayai.databases.mysql.entities.Title;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.localdbutil.LocalMySQLCrudServiceImpl;

import java.util.List;

/**
 * 被始化職稱
 */
public class CreateTitle {
    public static void main(String[] args) {
        List<String> titles
                = List.of("教師", "同學", "研究生", "教授", "研究助理", "助理", "管理者");
        IRDBCrudService<Title> titleIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        titles.forEach(title -> {
            Title t = new Title();
            t.setName(title);
            titleIRDBCrudService.create(t);
        });
    }
}
