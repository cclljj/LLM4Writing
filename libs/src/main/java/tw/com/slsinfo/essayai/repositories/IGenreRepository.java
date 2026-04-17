package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Genre;

import java.util.List;

/**
 * 單位(學校) 管理
 */
@Local
public interface IGenreRepository {


    /**
     * 取的 Genre 物件
     *
     * @param id
     * @return
     */
    Genre findId(int id);


    /**
     * 取的 Genre 物件
     *
     * @param id
     * @return
     */
    Genre referenceById(int id);

    /**
     * 更新單位資料
     *
     * @param genre
     * @return
     */
    Genre updateEntity(Genre genre);

    /**
     * 查詢單位
     *
     * @param enable 啟用狀態
     * @return
     */
    List<Genre> getGenreFilter(String enable, Integer sid, String llmtype);

    /**
     * 以gid查詢單位
     *
     * @param gid
     * @return
     */
    Genre getGenreById(int gid);

    /**
     * 查詢單位
     *
     * @param enable 啟用狀態
     * @param genre_id  作文名稱
     * @return
     */
    List<Genre> getEssayGenreFilter(String enable, int genre_id);

    /**
     * 查詢單位
     *
     * @return
     */
    List<Genre> getAllEssayGenre();
}
