package tw.com.slsinfo.essayai.models.course;

import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essay;
import tw.com.slsinfo.essayai.databases.mysql.entities.Genre;

public class EssayViewModel extends SerializeModel {

    private int id;
    private String title;
    private String etitle;
    private String enable;
    private int gid;
    private String genre;
    private String supplementarytxt;
    private Genre genreobject;
    private int sid;
    private String llmtype;

    public EssayViewModel() {
    }

    public void setId(int id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getEtitle() {
        return etitle;
    }

    public void setEtitle(String etitle) {
        this.etitle = etitle;
    }

    public String getEnable() {
        return enable;
    }

    public void setEnable(String enable) {
        this.enable = enable;
    }

    public int getGid() {
        return gid;
    }

    public void setGid(int gid) {
        this.gid = gid;
    }

    public String getGenre() {
        return genre;
    }

    public void setGenre(String genre) {
        this.genre = genre;
    }

    public String getSupplementarytxt() {
        return supplementarytxt;
    }

    public void setSupplementarytxt(String supplementarytxt) {
        this.supplementarytxt = supplementarytxt;
    }

    public int getSid() {
        return sid;
    }

    public void setSid(int sid) {
        this.sid = sid;
    }

    public Genre getGenreobject() {
        return genreobject;
    }

    public void setGenreobject(Genre genreobject) {
        this.genreobject = genreobject;
    }

    public static EssayViewModel createNew(Essay s) {
        return new EssayViewModel(s.getId(), s.getTitle(), s.getEtitle(), s.getEnable(), s.getGid().getId(), s.getGid().getGenre(), s.getSupplementarytxt(), s.getGid(), s.getLlmtype());
    }

    public EssayViewModel(int id, String title, String etitle, String enable, int gid, String genre, String supplementarytxt, Genre genreobject, String llmtype) {
        this.id = id;
        this.title = title;
        this.etitle = etitle;
        this.enable = enable;
        this.gid = gid;
        this.genre = genre;
        this.supplementarytxt = supplementarytxt;
        this.genreobject = genreobject;
        this.llmtype = llmtype;
    }

    public int getId() {
        return id;
    }

    public String getLlmtype() {
        return llmtype;
    }

    public void setLlmtype(String llmtype) {
        this.llmtype = llmtype;
    }
}
