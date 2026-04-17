package tw.com.slsinfo.essayai.repositories;

import com.mongodb.client.model.Filters;
import jakarta.ejb.EJB;
import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.bson.conversions.Bson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.databases.mongo.entities.Logs;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;
import tw.com.slsinfo.commons.database.generic.IMongoCrudService;
import tw.com.slsinfo.essayai.utils.AIConstants;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static com.mongodb.client.model.Filters.eq;

/**
 * 實作 ILogsRepository
 */
@Stateless
@Local(tw.com.slsinfo.essayai.repositories.ILogsRepository.class)
public class LogsRepositoryImpl implements tw.com.slsinfo.essayai.repositories.ILogsRepository {


    private static final Logger logger = LoggerFactory.getLogger(LogsRepositoryImpl.class);

    @EJB(name = "MongoCrudServiceImpl")
    private IMongoCrudService<Logs> iMongoCrudService;

    public LogsRepositoryImpl() {
    }

    @Override
    public List<Logs> getUid(String uid) {
        List<Logs> list = new ArrayList<>();
        Bson filter = Filters.eq(AIConstants.LOG_ACCOUNT, uid);
        iMongoCrudService.find(Logs.class, filter).into(list);
        logger.debug("Check log via account filter {} and result size {}", filter, list.size());
        return list;
    }

    @Override
    public List<Logs> getUid(String uid, EventType type) {
        List<Logs> list = new ArrayList<>();
        Bson filter = Filters.and(eq(AIConstants.LOG_ACCOUNT, uid), eq(AIConstants.LOG_EVENT, type));
        iMongoCrudService.find(Logs.class, filter).into(list);
        logger.debug("Check log via account and event filter {} and result size {}", filter, list.size());
        return list;
    }

    @Override
    public List<Logs> getUid(String uid, Date start, Date end, EventType type) {
        List<Logs> list = new ArrayList<>();
        Bson filter = Filters.and(eq(AIConstants.LOG_ACCOUNT, uid), eq(AIConstants.LOG_EVENT, type));

        if (ObjectUtils.isNotEmpty(start)) {
            filter = Filters.and(filter, Filters.gte("date", start));
        }

        if (ObjectUtils.isNotEmpty(end)) {
            filter = Filters.and(filter, Filters.lte("date", end));
        }
        iMongoCrudService.find(Logs.class, filter).into(list);
        logger.debug("Check log via multiple filters {} and result size {}", filter, list.size());
        return list;
    }

    @Override
    public List<Logs> getLogs(String uid, EventType type, String ip, Date date, String school) {
        List<Logs> list = new ArrayList<>();
        Bson filter = Filters.and(eq(AIConstants.LOG_ACCOUNT, uid), eq(AIConstants.LOG_EVENT, type));
        if (StringUtils.isNotEmpty(ip)) {
            filter = Filters.and(filter, eq(AIConstants.LOG_IP, ip));
        }
        if (ObjectUtils.isNotEmpty(date)) {
            filter = Filters.and(filter, Filters.gt("date", date));
        }
        if (ObjectUtils.isNotEmpty(school)) {
            filter = Filters.and(filter, eq(AIConstants.LOG_SCHOOLID, school));
        }
        iMongoCrudService.find(Logs.class, filter).into(list);
        logger.debug("Check log via multiple filters {} and result size {}", filter, list.size());
        return list;
    }
}
