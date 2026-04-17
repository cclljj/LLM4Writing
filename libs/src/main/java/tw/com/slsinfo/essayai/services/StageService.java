package tw.com.slsinfo.essayai.services;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.spi.CDI;
import jakarta.inject.Inject;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stage;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagelog;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagerecord;
import tw.com.slsinfo.essayai.models.course.ClassinfoViewModel;
import tw.com.slsinfo.essayai.models.openai.ChatPageModel;
import tw.com.slsinfo.essayai.repositories.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;


/**
 * 取得使用者活動歷程中的資料
 */
@ApplicationScoped
public class StageService {

    private static final Logger logger = LogManager.getLogger(StageService.class);

    @Inject
    private IStagelogRepository stagelogRepository;

    @Inject
    private IClassgroupRepository classgroupRepository;
    @Inject
    private IOpenclassRepository openclassRepository;
    @Inject
    private IClassinfoRepository classinfoRepository;
    @Inject
    private IStageRepository stageRepository;
    @Inject
    private IStagerecordRepository stagerecordRepository;

    // 追蹤每個 session 是否已寫入 stagelog (sessionId -> stageId -> written)
    private final Map<String, Map<Integer, Boolean>> sessionStageWrittenMap = new ConcurrentHashMap<>();

    /**
     * 以年班ID（目前一位使用者只有一個年班）及開課小組ID取得使用者目前活動進度
     *
     * @param cid  classinfo id
     * @param cgid classgroups id
     * @return
     */
    public List<Stagelog> findCurrentStagelog(Integer cid, Integer cgid) {
        return stagelogRepository.findCurrentStagelog(cid, cgid);
    }

    public Stage findStage(Integer id) {
        return stageRepository.findId(id);
    }

    public List<Stage> findAllStages(String llmtype, String chattype) {
        return stageRepository.findAllStages(llmtype, chattype);
    }

    /***
     * personal用的saveStagelog
     */
    public boolean saveStagelog(ChatPageModel chatPageModel,
                                String previousmsgid, Integer stageId, String messageid, String isend) {

        // 驗證必要參數
        if (previousmsgid == null || stageId == null || chatPageModel == null) {
            logger.warn("Cannot save stagelog - missing required data: previousmsgid={}, stageId={}",
                    previousmsgid, stageId);
            return false;
        }
        // 檢查是否已存在相同的記錄
        boolean isDuplicate = stagelogRepository.existsDuplicateStagelog(
                previousmsgid,
                messageid,
                stageId,
                chatPageModel.getCgid(),
                chatPageModel.getOcid(),
                chatPageModel.getMembercid(),
                isend
        );

        if (isDuplicate) {
            logger.debug("Stagelog already exists - skipping save. Stage: {}, ResponseID: {}, MessageID: {}",
                    stageId, previousmsgid, messageid);
            return false; // 或返回 true，視業務需求而定
        } else {
            logger.debug("isDuplicate false");
            logger.debug("previousmsgid:{},messageid:{},stageId:{},cgid:{},ocid:{},cid:{}", previousmsgid,
                    messageid,
                    stageId,
                    chatPageModel.getCgid(),
                    chatPageModel.getOcid(),
                    chatPageModel.getMembercid());
        }

        try {
            // 建立 stagelog 記錄
            Stagelog stagelog = new Stagelog();
            stagelog.setResponseid(previousmsgid);
            stagelog.setMessageid(messageid);
            stagelog.setCreated(Instant.now());
            stagelog.setCgid(classgroupRepository.referenceById(chatPageModel.getCgid()));
            stagelog.setOcid(openclassRepository.referenceById(chatPageModel.getOcid()));
            stagelog.setCid(classinfoRepository.referenceById(chatPageModel.getMembercid()));
            stagelog.setStageid(stageRepository.referenceById(stageId));
            stagelog.setIsend(isend);

            stagelogRepository.save(stagelog);

            logger.debug("Stagelog saved successfully -  Stage: {}, ResponseID: {}, CID: {}, CGID: {}, OCID: {}",
                    stageId, previousmsgid,
                    chatPageModel.getMembercid(),
                    chatPageModel.getCgid(),
                    chatPageModel.getOcid());

            return true;

        } catch (Exception e) {
            logger.debug("Failed to save stagelog record for stage: {}", stageId, e);
            return false;
        }
    }

    /***
     * group用的saveStagelog
     */
    public boolean saveMemeberStagelog(ChatPageModel chatPageModel,
                                       String previousmsgid, Integer stageId, String messageid) {

        // 驗證必要參數
        if (previousmsgid == null || stageId == null || chatPageModel == null) {
            logger.warn("Cannot save stagelog - missing required data: previousmsgid={}, stageId={}",
                    previousmsgid, stageId);
            return false;
        }
        logger.debug("--------before stage id :{}", stageId);
        logger.debug("StageService saveMemberStagelog previousmsgid: {} ; messageid : {}", previousmsgid, messageid);
        try {
            //建立cgid中所有組員的log紀錄
            List<ClassinfoViewModel> memberlist = CDI.current().select(ClassgroupmemberService.class).get()
                    .loadGroupMemberList(chatPageModel.getCgid());

            for (ClassinfoViewModel member : memberlist) {

                // 檢查是否已存在相同的記錄
                boolean isDuplicate = stagelogRepository.existsDuplicateStagelog(
                        previousmsgid,
                        messageid,
                        stageId,
                        chatPageModel.getCgid(),
                        chatPageModel.getOcid(),
                        member.getId(),
                        "0"
                );

                if (isDuplicate) {
                    logger.debug("Stagelog already exists - skipping save. Stage: {}, ResponseID: {}, MessageID: {}",
                            stageId, previousmsgid, messageid);
                    return false; // 或返回 true，視業務需求而定
                } else {
                    logger.debug("isDuplicate false");
                    logger.debug("previousmsgid:{},messageid:{},stageId:{},cgid:{},ocid:{},cid:{}", previousmsgid,
                            messageid,
                            stageId,
                            chatPageModel.getCgid(),
                            chatPageModel.getOcid(),
                            member.getId());
                }

                // 建立 stagelog 記錄
                Stagelog stagelog = new Stagelog();
                stagelog.setResponseid(previousmsgid);
                stagelog.setMessageid(messageid);
                stagelog.setCreated(Instant.now());
                stagelog.setCgid(classgroupRepository.referenceById(chatPageModel.getCgid()));
                stagelog.setOcid(openclassRepository.referenceById(chatPageModel.getOcid()));
                stagelog.setCid(classinfoRepository.referenceById(member.getId()));
                stagelog.setStageid(stageRepository.referenceById(stageId));
                stagelog.setIsend("0");

                stagelogRepository.save(stagelog);

                logger.debug("Stagelog saved successfully -  Stage: {}, ResponseID: {}, CID: {}, CGID: {}, OCID: {}",
                        stageId, previousmsgid,
                        member.getId(),
                        chatPageModel.getCgid(),
                        chatPageModel.getOcid());
            }

            return true;

        } catch (Exception e) {
            logger.debug("Failed to save stagelog record for stage: {}", stageId, e);
            return false;
        }
    }

    public boolean saveStageRecord(ChatPageModel chatPageModel,
                                   String content, Integer stageId, int seq, String istree) {

        // 驗證必要參數
        if (stageId == null || chatPageModel == null) {
            logger.warn("Cannot save stagelog - missing required data:  stageId={}", stageId);
            return false;
        }
        logger.debug("--------before stage id :{}", stageId);
        logger.debug("----------before stage content :{}", content);
        logger.debug("----------before stage seq :{}", seq);
        logger.debug("--------before :{}", chatPageModel.toString());
        try {
            // 建立 stagerecord 記錄
            Stagerecord stagerecord = new Stagerecord();
            stagerecord.setCid(classinfoRepository.referenceById(chatPageModel.getMembercid()));
            stagerecord.setOcid(openclassRepository.referenceById(chatPageModel.getOcid()));
            stagerecord.setCgid(classgroupRepository.referenceById(chatPageModel.getCgid()));
            stagerecord.setStageid(stageRepository.referenceById(stageId));
            stagerecord.setSeq(seq);
            stagerecord.setContent(content);
            stagerecord.setIstree(istree);
            stagerecord.setCreated(Instant.now());
            stagerecordRepository.save(stagerecord);
            return true;

        } catch (Exception e) {
            logger.debug("Failed to save stagerecord record for stage: {}", stageId, e);
            return false;
        }
    }

    public List<Stagerecord> findCurrentStagerecord(Integer cid, Integer cgid, Integer stageid, Integer seq) {
        return stagerecordRepository.findContentByUIDCGID(cid, cgid, stageid, seq);
    }

    public List<Stagerecord> getNewSeqByUIDCGID(Integer cid, Integer cgid, Integer stageid) {
        return stagerecordRepository.getNewSeqByUIDCGID(cid, cgid, stageid);
    }

    public List<Stagelog> findNewStagelog(Integer cgid, String chattype) {
        return stagelogRepository.findNewStagelog(cgid, chattype);
    }

    public Integer findNewStagelogInOpenClass(Integer ocid) {
        return stagelogRepository.findNewStagelogIdInOpenClass(ocid);
    }

}
