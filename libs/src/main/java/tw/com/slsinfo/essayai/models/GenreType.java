package tw.com.slsinfo.essayai.models;

/**
 * 作文體裁
 */
public enum GenreType {
//    //抒情文
//    LYRICAL,
//    //記敘文
//    NARRATIVE,
//    //說明文
//    EXPOSITORY,
//    //議論文
//    ARGUMENTATIVE

    //抒情文
    LYRICAL(4),
    //記敘文
    NARRATIVE(1),
    //說明文
    EXPOSITORY(2),
    //議論文
    ARGUMENTATIVE(3);

    private final int id;

    GenreType(int id) {
        this.id = id;
    }

    public int getId() {
        return id;
    }

    /**
     * 根據 ID 轉換為對應的 GenreType
     */
    public static GenreType fromId(int id) {
        for (GenreType type : GenreType.values()) {
            if (type.id == id) {
                return type;
            }
        }
        throw new IllegalArgumentException("找不到對應的 GenreType,ID: " + id);
    }
}
