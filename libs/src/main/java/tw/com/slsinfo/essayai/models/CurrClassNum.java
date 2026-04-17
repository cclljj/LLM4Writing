package tw.com.slsinfo.essayai.models;

import com.unboundid.util.NotNull;
import tw.com.slsinfo.commons.io.SerializeModel;

/**
 * 現在年班座號
 */
public class CurrClassNum extends SerializeModel {
    private String grade;
    private String _class;
    private String seatno;

    public CurrClassNum() {
    }

    /**
     * 傳入currclassnum進行剖析
     *
     * @param currclassnum
     */
    public CurrClassNum(@NotNull String currclassnum) {
        this.grade = currclassnum.substring(0, currclassnum.length() - 4);
        this._class = currclassnum.substring(currclassnum.length() - 4, currclassnum.length() - 2);
        this.seatno = currclassnum.substring(currclassnum.length() - 2);
    }

    public String getGrade() {
        return grade.replaceFirst("^0+(?!$)", "");
    }

    public CurrClassNum setGrade(String grade) {
        this.grade = grade;
        return this;
    }

    public String get_class() {
        return _class.replaceFirst("^0+(?!$)", "");
    }

    public CurrClassNum set_class(String _class) {
        this._class = _class;
        return this;
    }

    public String getSeatno() {
        return seatno.replaceFirst("^0+(?!$)", "");
    }

    public CurrClassNum setSeatno(String seatno) {
        this.seatno = seatno;
        return this;
    }

    public String getClassName() {
        return this.grade.concat("年").concat(this._class).concat("班");
    }
}
