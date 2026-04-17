package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.Operator;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essay;
import tw.com.slsinfo.essayai.databases.mysql.entities.Genre;

import java.util.ArrayList;
import java.util.List;

/**
 * 實作 ISchoolRepository
 */
@Stateless
@Local(IGenreRepository.class)
public class GenreRepositoryImpl implements IGenreRepository {

    private static final Logger logger = LoggerFactory.getLogger(GenreRepositoryImpl.class);

    @Inject
    private IRDBCrudService<Genre> genreIRDBCrudService;

    @Override
    public Genre findId(int id) {
        return genreIRDBCrudService.find(Genre.class, id);
    }

    @Override
    public Genre referenceById(int id) {
        return genreIRDBCrudService.reference(Genre.class, id);
    }

    @Override
    public Genre updateEntity(Genre genre) {
        return genreIRDBCrudService.update(genre);
    }

    @Override
    public List<Genre> getGenreFilter(String enable, Integer sid, String llmtype) {
        List<Operator> operators = new ArrayList<>();
        operators.add(new Operator(Operator.Condition.EQ, "sid.id", sid));

        if (StringUtils.isNotEmpty(enable)) {
            operators.add(new Operator(Operator.Condition.EQ, "enable", enable));
        }
        return genreIRDBCrudService.dynamicQuery(Genre.class, operators);
    }

    @Override
    public Genre getGenreById(int gid) {
        return genreIRDBCrudService.find(Genre.class, gid);
    }

    @Override
    public List<Genre> getEssayGenreFilter(String enable, int genre_id) {
        List<Operator> operators = new ArrayList<>();
        operators.add(new Operator(Operator.Condition.EQ, "id", genre_id));
        return genreIRDBCrudService.dynamicQuery(Genre.class, operators);
    }

    @Override
    public List<Genre> getAllEssayGenre() {
        String jpql = "SELECT g FROM Genre g";
        return genreIRDBCrudService.createQuery(jpql);
    }
}
