package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.Staticquestion;
import tw.com.slsinfo.essayai.utils.ComputationalThinking;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Stateless
@Local(IStaticQuestionRepository.class)
public class StaticQuestionRepositoryImpl implements IStaticQuestionRepository {

    private static final Logger logger = LoggerFactory.getLogger(StaticQuestionRepositoryImpl.class);


    @Inject
    private IRDBCrudService<Staticquestion> staticquestionIRDBCrudService;

    @Override
    public Staticquestion findId(int id) {
        return staticquestionIRDBCrudService.find(Staticquestion.class, id);
    }

    @Override
    public Staticquestion referenceById(int id) {
        return staticquestionIRDBCrudService.reference(Staticquestion.class, id);
    }

    @Override
    public Staticquestion updateEntity(Staticquestion staticquestion) {
        return staticquestionIRDBCrudService.update(staticquestion);
    }


    /**
     * {@inheritDoc}
     *
     * @param title                 作文名稱
     * @param computationalThinking CT向度
     * @return
     */
    @Override
    public List<Staticquestion> getStaticquestionFilter(String title, ComputationalThinking computationalThinking) {
        return staticquestionIRDBCrudService.findWithNamedQuery(NamedQueryNames.GET_QUESTIONS_BY_CT_TITLE,
                        QueryParameterBuilder.start("title", title).with("ct", computationalThinking.getDimenstion()))
                .stream().toList();
    }

    /**
     * {@inheritDoc}
     *
     * @param title
     * @return
     */
    @Override
    public Map<ComputationalThinking, List<Staticquestion>> getStaticQuestionMap(String title) {
        return staticquestionIRDBCrudService.findWithNamedQuery(NamedQueryNames.GET_QUESTIONS_BY_TITLE,
                QueryParameterBuilder.start("title", title)).stream().collect(
                Collectors.groupingBy(Staticquestion::getComputationalThinking)
        );
    }

    @Override
    public Staticquestion getStaticquestionyById(int id) {
        return staticquestionIRDBCrudService.find(Staticquestion.class, id);
    }

    @Override
    public void createStaticquestion(Staticquestion staticquestion) {
        staticquestionIRDBCrudService.create(staticquestion);
    }

    @Override
    public void deleteStaticquestionById(Integer id) {
        staticquestionIRDBCrudService.delete(Staticquestion.class, id);
    }
}
