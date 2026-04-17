package tw.com.slsinfo.essayai.repositories;

import jakarta.ejb.Local;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagelog;
import tw.com.slsinfo.essayai.databases.mysql.entities.Stagerecord;

import java.util.List;

/**
 * StageRecord
 */
@Local
public interface IStagerecordRepository {

    List<Stagerecord> findTreeByUIDCGID(int cid, int cgid);
    List<Stagerecord> findContentByUIDCGID(int cid, int cgid, int stageid,int seq);
    List<Stagerecord> getNewSeqByUIDCGID(int cid, int cgid, int stageid);
    List<Stagerecord> getNewSeqByUIDCGID(int cid, int cgid);
    void save(Stagerecord stagerecord);
}
