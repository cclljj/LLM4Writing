package tw.com.slsinfo.localdbutil.create;

import org.apache.commons.io.FilenameUtils;
import tw.com.slsinfo.commons.crypto.messagedigest.MDUtils;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.essayai.databases.mysql.entities.*;
import tw.com.slsinfo.localdbutil.DBUtils;
import tw.com.slsinfo.localdbutil.LocalMySQLCrudServiceImpl;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;


/**
 * 使用讀取CSV方式，匯入學生以及非學生
 */
public class CreateUser {

    public static void main(String[] args) {
        boolean isImportTea = false;//Boolean.parseBoolean(args[0]);
        List<String> lines = new ArrayList<>();
        if (isImportTea) {
            lines = DBUtils.readCSV("/Users/shengchehsiao/Documents/MyDocker/essayai/settings/imports/users.csv");
            lines.forEach(CreateUser::doCreateUser);
        } else {
            lines = DBUtils.readCSV("/Users/shengchehsiao/Documents/MyDocker/essayai/settings/imports/sts2.csv");
            lines.forEach(CreateUser::doCreateStudents);
        }
    }


    /**
     * 建立非學生使用者
     *
     * @param line
     */
    private static void doCreateUser(String line) {
        String data[] = line.split(",");
        User user = new User();

        user.setUid(data[0]);
        user.setName(data[1]);
        String pwd = MDUtils.getSHA256Hex(data[2]).get();
        user.setPassword(pwd);
        user.setEmail(data[3]);

        Role role = DBUtils.getRole(data[5]);
        Title title = DBUtils.getTitle(data[4]);
        School school = DBUtils.getSchool(data[6]);

        DBUtils.addUser(user);

        Roleuser roleuser = new Roleuser();
        roleuser.setRid(role);
        roleuser.setSid(school);
        roleuser.setUid(user);
        DBUtils.addRoleUser(roleuser);

        Titlesmapping titlesmapping = new Titlesmapping();
        titlesmapping.setSid(school);
        titlesmapping.setUid(user);
        titlesmapping.setTid(title);
        DBUtils.addTitleMapping(titlesmapping);

        //非學生年班座號寫0
        Classinfo classInfo = new Classinfo();
        classInfo.setUid(user);
        classInfo.setSid(school);
        classInfo.setGrade("0");
        classInfo.setSclass("0");
        classInfo.setSeatno("0");
        classInfo.setSno("");
        classInfo.setClassname("");
        DBUtils.addClassInfo(classInfo);
    }


    /**
     * 建立學生使用者
     *
     * @param line
     */
    private static void doCreateStudents(String line) {
        String data[] = line.split(",");
        User user = new User();

        user.setUid(data[0]);
        user.setName(data[1]);
        String pwd = MDUtils.getSHA256Hex(data[2]).get();
        user.setPassword(pwd);
        user.setEmail(data[3]);

        Role role = DBUtils.getRole(data[10]);
        Title title = DBUtils.getTitle(data[9]);
        School school = DBUtils.getSchool(data[8]);

        DBUtils.addUser(user);

        Roleuser roleuser = new Roleuser();
        roleuser.setRid(role);
        roleuser.setSid(school);
        roleuser.setUid(user);
        DBUtils.addRoleUser(roleuser);

        Titlesmapping titlesmapping = new Titlesmapping();
        titlesmapping.setSid(school);
        titlesmapping.setUid(user);
        titlesmapping.setTid(title);
        DBUtils.addTitleMapping(titlesmapping);

        Classinfo classInfo = new Classinfo();
        classInfo.setUid(user);
        classInfo.setSid(school);
        classInfo.setGrade(data[4]);
        classInfo.setSclass(data[5]);
        classInfo.setSeatno(data[6]);
        classInfo.setSno("");
        classInfo.setClassname(data[7]);
        DBUtils.addClassInfo(classInfo);
    }
}
