package tw.com.slsinfo.essayai.models.course;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classgroup;
import tw.com.slsinfo.essayai.databases.mysql.entities.Classinfo;
import tw.com.slsinfo.essayai.databases.mysql.entities.Rolepermission;

import java.io.Serializable;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import static java.util.stream.Collectors.groupingBy;

public class ClassGroupModel implements Serializable {
    private static final Logger logger = LogManager.getLogger(ClassGroupModel.class);
    private static final long serialVersionUID = 1L;

    private Integer id;
    private Integer ocid;
    private String groupname;
    private List<ClassinfoViewModel> members;
    private Instant created;
    private Instant modified;

    public ClassGroupModel() {
        this.members = new ArrayList<>();
    }

    public ClassGroupModel(Integer ocid, String groupname) {
        this();
        this.ocid = ocid;
        this.groupname = groupname;
    }

    // Getters and Setters
    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getOcid() {
        return ocid;
    }

    public void setOcid(Integer ocid) {
        this.ocid = ocid;
    }

    public String getGroupname() {
        return groupname;
    }

    public void setGroupname(String groupname) {
        this.groupname = groupname;
    }

    public List<ClassinfoViewModel> getMembers() {
        return members;
    }

    public void setMembers(List<ClassinfoViewModel> members) {
        this.members = members;
    }


    public ClassGroupModel(Classgroup classgroup, List<ClassinfoViewModel> members) {
        this.id = classgroup.getId();
        this.ocid = classgroup.getOcid().getId();
        this.groupname = classgroup.getGroupname();
        this.members = members;//members.stream().map(Classinfo::getId).distinct().toList();
        this.created = classgroup.getCreated();
        this.modified = classgroup.getModified();
    }


    public static ClassGroupModel createNew(Classgroup classgroup, List<ClassinfoViewModel> members) {
        return new ClassGroupModel(classgroup, members);
    }

    /**
     * 轉換為Entity
     *
     * @return Classgroup entity
     */
//    public Classgroup toEntity() {
//        Classgroup entity = new Classgroup(this.ocid, this.groupname);
//        entity.setId(this.id);
//        if (this.created != null) {
//            entity.setCreated(this.created);
//        }
//        if (this.modified != null) {
//            entity.setModified(this.modified);
//        }
//        return entity;
//    }

    /**
     * 新增成員
     *
     * @param memberId 成員ID
     */
    public void addMember(ClassinfoViewModel memberId) {
        if (memberId != null && !this.members.contains(memberId)) {
            this.members.add(memberId);
        }
    }

    /**
     * 移除成員
     *
     * @param memberId 成員ID
     */
    public void removeMember(Integer memberId) {
        this.members.remove(memberId);
    }

    /**
     * 清空所有成員
     */
    public void clearMembers() {
        this.members.clear();
    }

    /**
     * 檢查是否有成員
     *
     * @return 是否有成員
     */
    public boolean hasMembers() {
        return this.members != null && !this.members.isEmpty();
    }

    /**
     * 取得成員數量
     *
     * @return 成員數量
     */
    public int getMemberCount() {
        return this.members != null ? this.members.size() : 0;
    }

    @Override
    public String toString() {
        return "ClassGroupModel{" +
                "id=" + id +
                ", ocid=" + ocid +
                ", groupname='" + groupname + '\'' +
                ", memberCount=" + (members != null ? members.size() : 0) +
                '}';
    }
}