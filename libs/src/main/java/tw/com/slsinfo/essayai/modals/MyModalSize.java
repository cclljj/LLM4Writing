package tw.com.slsinfo.essayai.modals;

/**
 * Bootstrap Modal Size
 */
public enum MyModalSize {
    LG("modal-dialog modal-lg"),
    DEFAULT("modal-dialog"),
    SM("modal-dialog modal-sm"),
    FULL("modal-dialog modal-fullscreen"),
    XL("modal-dialog modal-xl");

    private String value;

    MyModalSize(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
