package tw.com.slsinfo.essayai.models.course;

import tw.com.slsinfo.commons.io.SerializeModel;
import tw.com.slsinfo.essayai.databases.mysql.entities.Essay;
import tw.com.slsinfo.essayai.databases.mysql.entities.Genre;

public class GenreModel extends SerializeModel {

    private int id;
    private String genre;

    public GenreModel() {
    }

    public void setId(int id) {
        this.id = id;
    }

    public static GenreModel createNew(Genre g) {
        return new GenreModel(g.getId(), g.getGenre());
    }

    public GenreModel(int id, String genre) {
        this.id = id;
        this.genre = genre;
    }


    public int getId() {
        return id;
    }
}
