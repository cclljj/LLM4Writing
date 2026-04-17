package tw.com.slsinfo.essayai.repositories;

import com.mongodb.client.model.Sorts;
import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import jakarta.inject.Inject;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.bson.conversions.Bson;
import tw.com.slsinfo.commons.database.generic.IMongoCrudService;
import tw.com.slsinfo.commons.database.generic.IRDBCrudService;
import tw.com.slsinfo.commons.database.generic.QueryParameterBuilder;
import tw.com.slsinfo.essayai.databases.mongo.entities.ChatLogs;
import tw.com.slsinfo.essayai.databases.mysql.NamedQueryNames;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stage;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagelog;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import static com.mongodb.client.model.Filters.and;
import static com.mongodb.client.model.Filters.eq;


@Stateless
@Local(IStageRepository.class)
public class StageRepositoryImpl implements IStageRepository {
    private static final Logger log = LogManager.getLogger(StageRepositoryImpl.class);
    @Inject
    private IRDBCrudService<Stage> stageService;

    @Inject
    private IMongoCrudService<ChatLogs> chatLogsService;

    @Inject
    private IStageRepository iStageRepository;

    @Override
    public Stage findId(int id) {
        return stageService.find(Stage.class, id);
    }

    @Override
    public List<Stage> findAllStages(String llmtype, String chattype) {
        return stageService.findWithNamedQuery(NamedQueryNames.GET_ALL_STAGE,
                QueryParameterBuilder.start("llmtype", llmtype).with("chattype", chattype).build());
    }

    @Override
    public Stage referenceById(int id) {
        return stageService.reference(Stage.class, id);
    }

    @Override
    public Stage updateEntity(Stage stage) {
        return stageService.update(stage);
    }


    /**
     * {@inheritDoc}
     *
     * @param stagename
     * @return
     */
    @Override
    public List<Stage> findStageByName(String stagename) {
        return stageService.findWithNamedQuery(NamedQueryNames.GET_STAGE_BY_NAME,
                QueryParameterBuilder.start("stagename", stagename).build());
    }

    /**
     * 取得指定 cgid 的所有不重複 stageid（降序排列）
     */
    @Override
    public List<Integer> getDistinctStageIdsByCgid(int cgid) {
        List<Integer> stageIds = new ArrayList<>();

        try {
            Bson filter = eq("cgid", cgid);
            Bson sort = Sorts.descending("stageid");

            // 取得所有記錄
            List<ChatLogs> allLogs = new ArrayList<>();
            chatLogsService.find(ChatLogs.class, filter)
                    .sort(sort)
                    .into(allLogs);

            // 使用 Java Stream 去重並排序
            stageIds = allLogs.stream()
                    .map(ChatLogs::getStageid)
                    .filter(stageId -> stageId != null)
                    .distinct()
                    .sorted((a, b) -> b.compareTo(a)) // 降序排列
                    .collect(Collectors.toList());

        } catch (Exception e) {
        }

        return stageIds;
    }

    /**
     * 根據 cgid 和 stageid 查詢對話記錄
     */
    @Override
    public List<ChatLogs> getChatLogsByCgidAndStageId(int cgid, int stageId) {
        List<ChatLogs> list = new ArrayList<>();

        try {
            Bson filter = and(
                    eq("cgid", cgid),
                    eq("stageid", stageId)
            );

            Bson sort = Sorts.ascending("timestamp");

            chatLogsService.find(ChatLogs.class, filter)
                    .sort(sort)
                    .into(list);

        } catch (Exception e) {
        }

        return list;
    }

    @Override
    public List<Integer> findbyNewStageidbycgid(int cgid) {
        return List.of();
    }

    @Override
    public List<Integer> findbyNewStageidbycgid(int cgid, int cid) {
        return List.of();
    }
}
