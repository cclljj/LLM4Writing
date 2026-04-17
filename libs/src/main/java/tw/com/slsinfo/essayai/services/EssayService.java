package tw.com.slsinfo.essayai.services;


import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.databases.mysql.entities.*;
import tw.com.slsinfo.essayai.models.course.EssayViewModel;
import tw.com.slsinfo.essayai.repositories.*;
import tw.com.slsinfo.essayai.utils.ComputationalThinking;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 單位(學校) 管理
 */

@Stateless
public class EssayService {

    @Inject
    private IEssayRepository iEssayRepository;
    @Inject
    private ISchoolRepository iSchoolRepository;
    @Inject
    private IGenreRepository iGenreRepository;
    @Inject
    private IStaticQuestionRepository iStaticQuestionRepository;

    private static final Logger logger = LogManager.getLogger(EssayService.class);

    public EssayService() {
    }

    public EssayService(IEssayRepository iEssayRepository, ISchoolRepository iSchoolRepository) {

        this.iEssayRepository = iEssayRepository;
        this.iSchoolRepository = iSchoolRepository;
    }

    /**
     * 取得此寫作主題中所有類型的問題
     *
     * @param title
     * @return
     */
    public Map<ComputationalThinking, List<Staticquestion>> getStaticQuestionMap(String title) {
        return iStaticQuestionRepository.getStaticQuestionMap(title);
    }

    /**
     * 取得此寫作主題中所有類型各1個問題，共6題
     *
     * @param title
     * @return
     */
    public List<String> getStaticQuestionList(String title) {
        List<String> list = new ArrayList<>();
        getStaticQuestionMap(title).forEach((k, v) -> {
                    list.add(v.get(ThreadLocalRandom.current().nextInt(0, v.size())).getQuestion());
                }
        );
        return list;
    }

    /**
     * 查詢單位 enable = 1
     *
     * @return
     */
    public List<EssayViewModel> getAllEssay(Integer sid, String llmtype
    ) {
        return getEssayView("1", null, sid, llmtype);
    }


    /**
     * 取得作文
     *
     * @return
     */
    public List<EssayViewModel> getEnableEssay(Integer sid, String llmtype) {

        return getEssayView("1", null, sid, llmtype);
    }

    /**
     * 查詢作文名稱
     *
     * @param title 作文名稱
     * @return
     */
    public List<EssayViewModel> getEssay(String title, Integer sid, String llmtype) {
        return iEssayRepository.getEssayFilter("1", title, sid, llmtype)
                .stream().map(EssayViewModel::createNew).toList();
    }

    /**
     * 查詢作文
     *
     * @param id 作文
     * @return
     */
    public EssayViewModel getEssay(int id) {
        return EssayViewModel.createNew(iEssayRepository.getEssayById(id));
    }

    /**
     * 取得作文
     *
     * @param title
     * @return
     */
    public List<Essay> getEssayByEssaytitle(String title, Integer sid, String llmtype) {
        return iEssayRepository.getEssayFilter("1", title, sid, llmtype);
    }

    /**
     * 取得作文
     *
     * @param eid
     * @return
     */
    public Essay getEssayByid(Integer eid) {

        return iEssayRepository.getEssayById(eid);
    }


    /**
     * 修改作文資料
     *
     * @param essayViewModel
     */
    public void updateEssay(EssayViewModel essayViewModel) {
        Essay essay = iEssayRepository.findId(essayViewModel.getId());
        essay.setEtitle(essayViewModel.getEtitle());
        essay.setTitle(essayViewModel.getTitle());
        essay.setGid(iGenreRepository.referenceById(essayViewModel.getGenreobject().getId()));
        essay.setEnable(essayViewModel.getEnable());
        essay.setSupplementarytxt(essayViewModel.getSupplementarytxt());
        iEssayRepository.updateEntity(essay);
    }

    /**
     * 查詢作文
     *
     * @param enable 是否啟用
     * @param title  作文名稱
     * @return
     */
    public List<EssayViewModel> getEssayView(String enable, String title, Integer sid, String llmtype) {
        List<EssayViewModel> results = new ArrayList<>();
        List<Essay> essays = iEssayRepository.getEssayFilter(enable, title, sid, llmtype);

        essays.forEach(e -> {
            results.add(EssayViewModel.createNew(e));
        });
        return results;
    }

    /**
     * 查詢文學體裁
     *
     * @return
     */
    public List<Genre> getAllEssayGenre() {
        return iGenreRepository.getAllEssayGenre();
    }

    /***
     * 新增資料
     * @param model
     * @return
     */
    public boolean createEssay(EssayViewModel model, User user) {
        try {
            School school = iSchoolRepository.referenceById(model.getSid());
            Genre genre = iGenreRepository.referenceById(model.getGid());

            Essay essay = new Essay();
            essay.setSid(school);
            essay.setTitle(model.getTitle());
            essay.setEnable(model.getEnable());
            essay.setGid(genre);
            essay.setSupplementarytxt(model.getSupplementarytxt());
            essay.setLlmtype(model.getLlmtype());
            essay.setCreated(Instant.now());
            essay.setModified(Instant.now());
            iEssayRepository.createEssay(essay);
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
    public void deleteEssay(EssayViewModel model) {
        iEssayRepository.deleteEssay(model.getId());
    }

}
