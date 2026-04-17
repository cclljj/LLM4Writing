package tw.com.slsinfo.essayai.models.openai;

import tw.com.slsinfo.commons.io.SerializeModel;

public class ExpiresAfterModel extends SerializeModel {
    /** e.g. "last_active_at"（或其他 anchor） */
    private String anchor;

    /** 幾天後到期 */
    private Integer days;

    public ExpiresAfterModel() {
    }

    public String getAnchor() {
        return anchor;
    }

    public void setAnchor(String anchor) {
        this.anchor = anchor;
    }

    public Integer getDays() {
        return days;
    }

    public void setDays(Integer days) {
        this.days = days;
    }
}
