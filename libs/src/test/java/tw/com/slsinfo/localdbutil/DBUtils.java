package tw.com.slsinfo.localdbutil;

import org.apache.commons.io.FilenameUtils;
import org.junit.jupiter.api.Test;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.*;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Local AIDB Utils
 */
public class DBUtils {

    public static void addSchool(School school) {
        IRDBCrudService<School> schoolIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        schoolIRDBCrudService.create(school);
    }

    public static void addStaticquestion(Staticquestion staticquestion) {
        IRDBCrudService<Staticquestion> staticquestionIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        staticquestionIRDBCrudService.create(staticquestion);
    }

    public static void addTitle(Title title) {
        IRDBCrudService<Title> schoolIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        schoolIRDBCrudService.create(title);
    }

    public static School getSchool(String schoolId) {
        IRDBCrudService<School> schoolIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        List<School> schools = schoolIRDBCrudService.findWithNamedQuery(NamedQueryNames.FIND_SCHOOL_BY_SCHOOLID,
                QueryParameterBuilder.start("schoolid", schoolId).build());

        System.out.println("Find School : " + schools.size());
        if (schools.isEmpty()) {
            return null;
        } else {
            return schools.get(0);
        }

    }

    public static Title getTitle(String title) {
        IRDBCrudService<Title> titleIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        List<Title> titles = titleIRDBCrudService.findWithNamedQuery(NamedQueryNames.FIND_TITLE_BY_TITLENAME,
                QueryParameterBuilder.start("title", title).build());

        System.out.println("Find Title : " + titles.size());
        if (titles.isEmpty()) {
            return null;
        } else {
            return titles.get(0);
        }

    }

    public static Role getRole(String role) {
        IRDBCrudService<Role> roleIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        List<Role> roles = roleIRDBCrudService.findWithNamedQuery(NamedQueryNames.FIND_ROLE_BY_ROLENAME,
                QueryParameterBuilder.start("rolename", role).build());

        System.out.println("Find Role : " + roles.size());
        if (roles.isEmpty()) {
            return null;
        } else {
            return roles.get(0);
        }

    }

    public static Titlesmapping addTitleMapping(Titlesmapping titlesmapping) {
        IRDBCrudService<Titlesmapping> titlesmappingIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        return titlesmappingIRDBCrudService.create(titlesmapping);
    }


    public static User addUser(User user) {
        IRDBCrudService<User> schoolIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        return schoolIRDBCrudService.create(user);
    }

    public static void addClassInfo(Classinfo classInfo) {
        IRDBCrudService<Classinfo> schoolIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        schoolIRDBCrudService.create(classInfo);
    }

    public static Roleuser addRoleUser(Roleuser roleuser) {
        IRDBCrudService<Roleuser> roleuserIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        return roleuserIRDBCrudService.create(roleuser);
    }

    /**
     * 讀CSV檔共用函式
     *
     * @param fileName
     * @return
     */
    public static List<String> readCSV(String fileName) {
        List<String> lines = new ArrayList<>();
        try (FileReader fileReader = new FileReader(
                FilenameUtils.normalize(fileName), StandardCharsets.UTF_8);
             BufferedReader bufferedReader = new BufferedReader(fileReader)) {
            String line;

            while ((line = bufferedReader.readLine()) != null) {
                lines.add(line);
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        return lines;
    }

}
