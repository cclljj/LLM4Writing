package tw.com.slsinfo.essayai.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;
import tw.com.slsinfo.essayai.models.course.ClassinfoViewModel;
import tw.com.slsinfo.essayai.repositories.IClassinfoRepository;

import java.util.ArrayList;
import java.util.List;

@ApplicationScoped
public class ClassInfoService {
    private static final Logger logger = LogManager.getLogger(ClassInfoService.class);

    @PersistenceContext
    private EntityManager em;

    @Inject
    private IClassinfoRepository iClassinfoRepository;

    /**
     * 查詢作
     *
     * @param sid sid
     * @return
     */
    public List<ClassinfoViewModel> getStuClassinfoView(Integer sid, String llmtype) {
        List<ClassinfoViewModel> results = new ArrayList<>();
        List<Classinfo> classinfos = iClassinfoRepository.getStuClassinfoFilter(sid, llmtype);

        classinfos.forEach(e -> {
            results.add(ClassinfoViewModel.createNew(e));
        });
        return results;
    }

    public Classinfo getClassinfoViewByid(Integer cid) {
        return iClassinfoRepository.getClassinfoById(cid);
    }

    public List<Classinfo> getClassinfoBySid(Integer sid, String llmtype) {
        return iClassinfoRepository.getStuClassinfoFilter(sid, llmtype);
    }

}