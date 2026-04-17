package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Staticquestion;
import tw.com.slsinfo.essayai.utils.ComputationalThinking;

import java.util.List;
import java.util.Map;

@Local
public interface IStaticQuestionRepository {

    /**
     * 取的 Staticquestion 物件
     *
     * @param id
     * @return
     */
    Staticquestion findId(int id);


    /**
     * 取的 Staticquestion 物件
     *
     * @param id
     * @return
     */
    Staticquestion referenceById(int id);

    /**
     * update StaticQuestions
     *
     * @param staticquestion
     * @return
     */
    Staticquestion updateEntity(Staticquestion staticquestion);

    /**
     * 查詢Staticquestion
     *
     * @param title                 作文名稱
     * @param computationalThinking CT向度
     * @return
     */
    List<Staticquestion> getStaticquestionFilter(String title, ComputationalThinking computationalThinking);


    /**
     * 以寫作文題取得階段一問題
     *
     * @return
     */
    Map<ComputationalThinking, List<Staticquestion>> getStaticQuestionMap(String title);


    /**
     * 以id查詢staticquestion
     *
     * @param essay_id
     * @return
     */
    Staticquestion getStaticquestionyById(int id);

    /**
     * 建置 Essay
     *
     * @param staticquestion
     */
    void createStaticquestion(Staticquestion staticquestion);

    void deleteStaticquestionById(Integer id);
}
