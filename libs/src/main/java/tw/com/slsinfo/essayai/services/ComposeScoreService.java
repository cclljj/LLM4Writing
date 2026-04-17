package tw.com.slsinfo.essayai.services;


import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.validation.constraints.NotNull;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;
import tw.com.slsinfo.essayai.databases.mysql.entities.Composescore;
import tw.com.slsinfo.essayai.databases.mysql.entities.Openclass;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;
import tw.com.slsinfo.essayai.models.course.ComposeScoreModel;
import tw.com.slsinfo.essayai.models.wicket.school.SchoolInfoView;
import tw.com.slsinfo.essayai.repositories.IComposeScoreRepository;
import tw.com.slsinfo.essayai.repositories.ISchoolRepository;

import java.util.ArrayList;
import java.util.List;

@Stateless
public class ComposeScoreService {

    private static final Logger logger = LoggerFactory.getLogger(ComposeScoreService.class);

    @Inject
    private IComposeScoreRepository iComposeScoreRepository;

    public ComposeScoreService() {
    }

    /**
     * 新增作文評分(僅新增 compose, aiscore, aicomment)
     * @param model 作文評分模型
     */
    public void insertComposeScore(ComposeScoreModel model) {
        Composescore composescore = new Composescore();

        // 設定關聯的 Openclass 和 Classinfo
        Openclass openclass = new Openclass();
        openclass.setId(model.getOcid());
        composescore.setOcid(openclass);

        Classinfo classinfo = new Classinfo();
        classinfo.setId(model.getCid());
        composescore.setCid(classinfo);

        // 只設定 compose, aiscore, aicomment
        composescore.setCompose(model.getCompose());
        composescore.setAiscore(model.getAiscore());
        composescore.setAicomment(model.getAicomment());

        // 使用 createEntity 方法新增
        iComposeScoreRepository.createEntity(composescore);
    }

    /***
     * 教師評分
     * @param model
     */
    public void updateComposeScore(ComposeScoreModel model) {
        Composescore composescore = iComposeScoreRepository.findId(model.getId());
        composescore.setScore(model.getScore());
        composescore.setComment(model.getComment());
        iComposeScoreRepository.updateEntity(composescore);
    }

    public List<ComposeScoreModel> getComposeScore(int ocid, int cid) {
        List<ComposeScoreModel> results = new ArrayList<>();
        List<Composescore> composescores = iComposeScoreRepository.getComposescoreFilter(ocid, cid);

        composescores.forEach(e -> {
            results.add(ComposeScoreModel.createNew(e));
        });
        return results;
    }
}
