package tw.com.slsinfo.essayai.services;


import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import jakarta.validation.constraints.NotNull;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.databases.mysql.entities.School;
import tw.com.slsinfo.essayai.models.wicket.school.SchoolInfoView;
import tw.com.slsinfo.essayai.repositories.ISchoolRepository;

import java.util.ArrayList;
import java.util.List;

/**
 * 單位(學校) 管理
 */
@Stateless
public class SchoolService {

    private static final Logger logger = LoggerFactory.getLogger(SchoolService.class);

    @Inject
    private ISchoolRepository iSchoolRepository;

    public SchoolService() {
    }

    /**
     * 查詢單位 enable = 1
     *
     * @return
     */
    public List<SchoolInfoView> getAllSchool() {
        return getSchoolInfoView("1", true, null, null);
    }


    /**
     * 取得能檢視單位
     *
     * @return
     */
    public List<SchoolInfoView> getEnableSchool(boolean isAdmin, String schoolid) {
        return getSchoolInfoView("1", isAdmin, null, schoolid);
    }

    /**
     * 查詢學校資料
     *
     * @param schoolname 單位名稱
     * @param schoolid   單位代碼
     * @return
     */
    public List<SchoolInfoView> getSchool(@NotNull String schoolname, @NotNull SchoolInfoView schoolid) {
        return iSchoolRepository.getSchoolFilter("1", schoolname, ObjectUtils.isNotEmpty(schoolid) ? schoolid.getSchoolid() : StringUtils.EMPTY)
                .stream().map(SchoolInfoView::createNew).toList();
    }


    /**
     * 以學校代碼取得School資料
     *
     * @param schoolid
     * @return
     */
    public List<School> getSchoolBySchoolId(String schoolid) {
        return iSchoolRepository.getSchoolBySchoolId(schoolid);
    }

    /**
     * 以學校代碼取得School資料
     *
     * @param sid
     * @return
     */
    public School getSchoolBySId(Integer sid) {
        return iSchoolRepository.findId(sid);
    }

    /**
     * 修改單位資料
     *
     * @param schoolInfoView
     */
    public void updateSchool(SchoolInfoView schoolInfoView) {
        School school = iSchoolRepository.findId(schoolInfoView.getId());
        school.setFname(schoolInfoView.getSchoolname());
        iSchoolRepository.updateEntity(school);
    }

    /**
     * 查詢學校
     * school to schoolInfoView
     *
     * @param enable     是否啟用
     * @param isAdmin    是否為管理權限
     * @param schoolid   學校代碼
     * @param schoolname 學校名稱
     * @return
     */
    private List<SchoolInfoView> getSchoolInfoView(String enable, boolean isAdmin, String schoolname, String schoolid) {
        List<SchoolInfoView> results = new ArrayList<>();
        List<School> schools;
        if (isAdmin) {
            schools = iSchoolRepository.getSchoolFilter(enable, null, null);
        } else {
            schools = iSchoolRepository.getSchoolFilter(enable, schoolname, schoolid);
        }
        schools.forEach(e -> {
            results.add(SchoolInfoView.createNew(e));
        });
        return results;
    }


}
