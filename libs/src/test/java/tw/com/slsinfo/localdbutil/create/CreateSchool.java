package tw.com.slsinfo.localdbutil.create;

import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;
import tw.com.slsinfo.localdbutil.DBUtils;
import tw.com.slsinfo.localdbutil.LocalMySQLCrudServiceImpl;

import java.util.ArrayList;
import java.util.List;

/**
 * 建立學校資料
 */
public class CreateSchool {

    public static void main(String[] args) {
        List<String> lines = DBUtils.readCSV("/Users/shengchehsiao/Documents/MyDocker/essayai/settings/imports/schools.csv");

        IRDBCrudService<School> schoolIRDBCrudService = new LocalMySQLCrudServiceImpl<>();
        lines.forEach(line -> {
            String data[] = line.split(",");
            School school = new School();
            school.setSid(data[0]);
            school.setFname(data[1]);
            school.setEnable('1');
            schoolIRDBCrudService.create(school);
        });
    }
}
