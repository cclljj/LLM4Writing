package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.validation.constraints.NotNull;
import tw.com.slsinfo.essayai.databases.mysql.entities.Title;
import tw.com.slsinfo.essayai.databases.mysql.entities.Titlesmapping;

import java.util.List;

@Local
public interface IUserTitlesRepository {


    /**
     * 查詢學生職稱
     *
     * @return
     */

    Title getStudentTitleName();

    /**
     * 查詢學生職稱
     *
     * @return
     */

    Title getTeacherTitleName();

    /**
     * 查詢職稱
     *
     * @param name 職稱
     * @return
     */
    List<Title> getTitles(String name);


    List<Titlesmapping> getUserTitles(@NotNull String uid);


    List<Titlesmapping> getUserTM(@NotNull String uid, @NotNull String schoolid);


}
