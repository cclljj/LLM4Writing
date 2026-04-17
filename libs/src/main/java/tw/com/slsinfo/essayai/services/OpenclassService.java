package tw.com.slsinfo.essayai.services;


import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essay;
import tw.com.slsinfo.essayai.databases.mysql.entities.Openclass;
import tw.com.slsinfo.essayai.databases.mysql.entities.User;
import tw.com.slsinfo.essayai.models.course.EssayViewModel;
import tw.com.slsinfo.essayai.models.course.OpenClassModel;
import tw.com.slsinfo.essayai.models.course.OpenClassesView;
import tw.com.slsinfo.essayai.repositories.IEssayRepository;
import tw.com.slsinfo.essayai.repositories.IOpenclassRepository;
import tw.com.slsinfo.essayai.repositories.ISchoolRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * 課程管理
 */
@Stateless
public class OpenclassService {

    private static final Logger logger = LoggerFactory.getLogger(OpenclassService.class);

    @Inject
    private IOpenclassRepository iOpenclassRepository;
    @Inject
    private IEssayRepository iEssayRepository;
    @Inject
    private ISchoolRepository iSchoolRepository;

    public OpenclassService() {
    }

    public OpenclassService(IOpenclassRepository iOpenclassRepository, IEssayRepository iEssayRepository) {
        this.iOpenclassRepository = iOpenclassRepository;
        this.iEssayRepository = iEssayRepository;
    }

    /**
     * 查詢開課 enable = 1
     *
     * @return
     */
    public List<OpenClassesView> getAllOpenClasses(Integer sid, String llmtype) {
        return getOpenClasses(sid, "1", null, null, llmtype);
    }


    /**
     * 取得能檢視單位
     *
     * @return
     */
    public List<OpenClassesView> getEnableClassname(Integer sid, String classname, String llmtype) {
        return getOpenClasses(sid, "1", classname, null, llmtype);
    }

    /**
     * 取得能檢視單位
     *
     * @return
     */
    public List<OpenClassesView> getEnableClassname(Integer sid, Integer uid, String llmtype) {
        return getOpenClasses(sid, uid, "1", llmtype);
    }

    /**
     * 查詢開課資料
     *
     * @param eid 科目編號
     * @return
     */
    public List<OpenClassesView> getOpenClasses(Integer sid, String enable, String classname, Integer eid, String llmtype) {

        List<OpenClassesView> results = new ArrayList<>();
        List<Openclass> openclasses = iOpenclassRepository.getOpenClassFilter(sid, enable, classname, eid, llmtype);

        openclasses.forEach(e -> {
            results.add(OpenClassesView.createNew(e, e.getEid()));
        });
        return results;
    }

    /**
     * 查詢開課資料
     *
     * @return
     */
    public List<OpenClassesView> getOpenClasses(Integer sid, Integer uid, String enable, String llmtype) {

        List<OpenClassesView> results = new ArrayList<>();
        List<Openclass> openclasses = iOpenclassRepository.getOpenClassFilter(sid, uid, enable, llmtype);
        openclasses.forEach(e -> {
            results.add(OpenClassesView.createNew(e, e.getEid()));
        });
        return results;
    }

    public OpenClassesView getOpenClasses(Integer ocid) {

        Openclass openclasses = iOpenclassRepository.getOpenClassOne(ocid);
        return OpenClassesView.createNew(openclasses, openclasses.getEid());
    }

    /**
     * 修改資料
     *
     * @param openClassesView
     */
    public void updateOpenclass(OpenClassesView openClassesView, User user) {
        Essay essay = iEssayRepository.referenceById(openClassesView.getEssay().getId());

        Openclass openclass = iOpenclassRepository.findId(openClassesView.getId());
        openclass.setClassname(openClassesView.getClassname());
        openclass.setEid(essay);
        openclass.setDiscussiontime(openClassesView.getDiscussiontime());
        openclass.setSupplementarytxt(openClassesView.getSupplementarytxt());
        openclass.setEnable(openClassesView.getEnable());
        openclass.setSid(openClassesView.getSid());
        openclass.setModified(Instant.now());
        openclass.setModifieduid(user);
        iOpenclassRepository.updateEntity(openclass);
    }

    /***
     * 新增資料
     * @param model
     * @return
     */
    public boolean createOpenclass(OpenClassModel model, User user) {
        try {
            Essay essay = iEssayRepository.referenceById(model.getEssay().getId());

            Openclass openclass = new Openclass();
            openclass.setClassname(model.getClassname());
            openclass.setEid(essay);
            openclass.setDiscussiontime(model.getDiscussiontime());
            openclass.setSupplementarytxt(model.getSupplementarytxt());
            openclass.setEnable(model.getEnable());
            openclass.setSid(model.getSid());
            openclass.setCreated(Instant.now());
            openclass.setModified(Instant.now());
            openclass.setCreateduid(user);
            openclass.setModifieduid(user);
            openclass.setLlmtype(model.getLlmtype());
            iOpenclassRepository.createOpenclass(openclass);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 刪除科目
     *
     * @param model
     */
    public void deleteOpenclass(OpenClassesView model) {
        iOpenclassRepository.deleteOpenclass(model.getId());
    }
}
