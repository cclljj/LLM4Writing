package tw.com.slsinfo.essayai.controls;

import jakarta.enterprise.inject.spi.CDI;
import org.apache.wicket.markup.html.form.ChoiceRenderer;
import org.apache.wicket.markup.html.form.DropDownChoice;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.databases.mysql.entities.Genre;
import tw.com.slsinfo.essayai.services.EssayService;

import java.util.List;

public class GenreDropDownChoice extends DropDownChoice<Genre> {

    private static final Logger logger = LoggerFactory.getLogger(GenreDropDownChoice.class);

    private List<Genre> genres;
    private Integer sid; // 保存 sid 以供後續使用

    public GenreDropDownChoice(String id, Integer sid) {
        super(id);
        this.sid = sid;
        init(true, sid);
    }

    public GenreDropDownChoice(String id, boolean required, Integer sid) {
        super(id);
        this.sid = sid;
        init(required, sid);
    }
    // 加入公開的 getter 方法
    public List<Genre> getGenres() {
        return genres;
    }

    public void init(boolean required, Integer sid) {
        genres = CDI.current().select(EssayService.class).get().getAllEssayGenre();
        setChoices(genres);
        setOutputMarkupId(true);
        setRequired(required);
        setChoiceRenderer(new ChoiceRenderer<Genre>() {

            @Override
            public Object getDisplayValue(Genre object) {
                return object.getGenre();
            }

            @Override
            public String getIdValue(Genre object, int index) {
                return String.valueOf(object.getId());
            }

        });
        setDefault();
    }

    /**
     * 根據 OpenClassesView 設定下拉選單的值
     *
     * @param genre 包含資料的模型物件
     */
    public void setModelObjectFromView(Genre genre) {
        if (genre == null) {
            setModelObject(null);
            return;
        }
        // 設定Essay下拉選單的預設值
        if (genre.getGenre() != null) {
            setModelObject(genre);
        }  else {
            setModelObject(null);
        }
    }

    /**
     * 給於預設
     *
     * @return
     */
    protected void setDefault() {

    }

    @Override
    public void convertInput() {
        String value = getValue();
        logger.debug("convertInput - raw value: {}", value);

        if (value != null && !value.isEmpty()) {
            try {
                Integer genreId = Integer.parseInt(value);
                Genre selectedGenre = genres.stream()
                        .filter(genre -> genreId.equals(genre.getId()))
                        .findFirst()
                        .orElse(null);

                logger.debug("convertInput - converted to Genre: {}", selectedGenre);
                setConvertedInput(selectedGenre);
            } catch (NumberFormatException e) {
                logger.debug("Failed to parse genre ID: {}", value, e);
                setConvertedInput(null);
            }
        } else {
            setConvertedInput(null);
        }
    }
}
