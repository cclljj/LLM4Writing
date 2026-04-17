package tw.com.slsinfo.essayai.models.course;

import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.Genre;

public class UserModel extends SerializeModel {

    private int id;
    private String uid;
    private String name;

    public UserModel() {
    }

    public void setId(int id) {
        this.id = id;
    }

    public static UserModel createNew(Genre g) {
        return new UserModel(g.getId(), g.getGenre());
    }

    public UserModel(int id, String uid) {
        this.id = id;
        this.uid = uid;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getId() {
        return id;
    }
}
