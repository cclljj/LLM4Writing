package tw.com.slsinfo.essayai.models.course;

import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.Genre;

public class SchoolModel extends SerializeModel {

    private int id;
    private String sid;
    private String fname;
    private String enable;

    public SchoolModel() {
    }

    public void setId(int id) {
        this.id = id;
    }

    public static SchoolModel createNew(Genre g) {
        return new SchoolModel(g.getId(), g.getGenre());
    }

    public SchoolModel(int id, String sid) {
        this.id = id;
        this.sid = sid;
    }

    public String getSid() {
        return sid;
    }

    public void setSid(String sid) {
        this.sid = sid;
    }

    public String getFname() {
        return fname;
    }

    public void setFname(String fname) {
        this.fname = fname;
    }

    public String getEnable() {
        return enable;
    }

    public void setEnable(String enable) {
        this.enable = enable;
    }

    public int getId() {
        return id;
    }
}
