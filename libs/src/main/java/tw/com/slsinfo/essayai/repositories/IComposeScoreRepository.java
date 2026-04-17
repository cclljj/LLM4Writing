package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Composescore;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;
import tw.com.slsinfo.essayai.models.course.ComposeScoreModel;

import java.util.List;

@Local
public interface IComposeScoreRepository {

    /**
     * 取的 Composescore 物件
     *
     * @param id
     * @return
     */
    Composescore findId(int id);

    /**
     * 取的 Composescore 物件
     *
     * @param id
     * @return
     */
    Composescore referenceById(int id);

    Composescore updateEntity(Composescore composescore);

    List<Composescore> getComposescoreFilter(int ocid, int cid);

    Composescore createEntity(Composescore composescore);
}
