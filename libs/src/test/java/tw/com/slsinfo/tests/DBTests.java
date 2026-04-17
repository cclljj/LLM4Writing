package tw.com.slsinfo.tests;

import jakarta.enterprise.inject.spi.CDI;
import jakarta.validation.constraints.NotNull;
import org.apache.commons.io.FilenameUtils;
import org.junit.jupiter.api.Test;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.Role;
import tw.com.slsinfo.essayai.databases.mysql.entities.Roleuser;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;
import tw.com.slsinfo.essayai.databases.mysql.entities.Staticquestion;
import tw.com.slsinfo.essayai.services.RoleUserService;
import tw.com.slsinfo.localdbutil.DBUtils;
import tw.com.slsinfo.localdbutil.LocalMySQLCrudServiceImpl;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Local DB Test Case
 */
class DBTests {


    /**
     * 連線測試
     */
    @Test
    void doConnection() {
        IRDBCrudService<School> schoolIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        int size = schoolIRDBCrudService.findWithNamedQuery(NamedQueryNames.FIND_SCHOOL_BY_SCHOOLID,
                QueryParameterBuilder.start("schoolid", "192000").build()).size();
        System.out.println(size);
    }

    //    @Test
    void getRoleUser() {
//        IRDBCrudService<Roleuser> roleuserIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
//        roleuserIRDBCrudService.findAll(Roleuser.class).forEach(System.out::println);
    }

    //    @Test
    void getSTRoleUser() {
        IRDBCrudService<Roleuser> roleuserIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        IRDBCrudService<Role> roleIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        IRDBCrudService<School> schoolIRDBCrudService = new LocalMySQLCrudServiceImpl<>();

        String roleName = "學生";
        Role role = roleIRDBCrudService.findWithNamedQuery(NamedQueryNames.FIND_ROLE_BY_ROLENAME, QueryParameterBuilder.start("rolename", roleName)).get(0);

        roleuserIRDBCrudService.findCacheableWithNamedQuery(NamedQueryNames.FIND_ROLEUSER_BY_SID_RID
                , QueryParameterBuilder.start("rid", role).with("schoolid", schoolIRDBCrudService.find(School.class, 2).getSid()).build()).forEach(f -> System.out.println(f.getUid().getName()));
    }

    //@Test
    void importStaticQuestions() {
        List<String> questions = DBUtils.readCSV("/Users/shengchehsiao/Documents/MyDocker/essayai/questions.csv");
        questions.forEach(
                question -> {
                    String[] q = question.split(",");
                    Staticquestion staticquestion = new Staticquestion();
                    staticquestion.setEssaytitle(q[0]);
                    staticquestion.setCtdimension(q[1]);
                    staticquestion.setQuestion(q[2]);
                    DBUtils.addStaticquestion(staticquestion);
                }
        );

    }
}
