package tw.com.slsinfo.essayai.services;

import org.apache.commons.lang3.ObjectUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;
import tw.com.slsinfo.essayai.models.wicket.logs.LogInfoView;
import tw.com.slsinfo.essayai.models.wicket.school.SchoolInfoView;
import tw.com.slsinfo.essayai.repositories.ILogsRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;

/**
 * 日誌服務工具類別
 */
public abstract class LogsService {
    private static final Logger logger = LoggerFactory.getLogger(LogsService.class);


    /**
     * 使用者登入紀錄
     *
     * @param uid
     * @return
     */
    public static List<LogInfoView> getUserLogin(ILogsRepository logsRepository, String uid) {
        List<LogInfoView> list = new ArrayList<>();
        logsRepository.getUid(uid, EventType.LOGIN).forEach(log -> {
            list.add(LogInfoView.createNew(log));
        });
        list.sort(Comparator.comparing(LogInfoView::getDate).reversed());
        logger.debug("{} Login count {}", uid, list.size());
        return list;
    }

    /**
     * 取得使用記錄
     *
     * @param logsRepository log repository object
     * @param uid            使用者帳號
     * @param eventType      event type to be filtered
     * @return
     */
    public static List<LogInfoView> getUserBehavior(ILogsRepository logsRepository, String uid, EventType eventType) {
        List<LogInfoView> list = new ArrayList<>();
        logsRepository.getUid(uid, eventType).forEach(log -> {
            list.add(LogInfoView.createNew(log));
        });
        list.sort(Comparator.comparing(LogInfoView::getDate).reversed());
        logger.debug("{} log count {}", uid, list.size());
        return list;

    }

    /**
     * @param logsRepository log repository object
     * @param uid            使用者帳號
     * @param eventType      事件
     * @param ip             IP位置
     * @param date           日期
     * @param school         學校代碼
     * @return
     */
    public static List<LogInfoView> getUserBehavior(ILogsRepository logsRepository, String uid, EventType eventType, String ip, Date date, SchoolInfoView school) {
        List<LogInfoView> list = new ArrayList<>();
        String schoolid = ObjectUtils.isNotEmpty(school) ? school.getSchoolid() : null;
        logsRepository.getLogs(uid, eventType, ip, date, schoolid).forEach(log -> list.add(LogInfoView.createNew(log)));
        list.sort(Comparator.comparing(LogInfoView::getDate).reversed());
        logger.debug("{} log count {}", uid, list.size());
        return list;

    }


}
