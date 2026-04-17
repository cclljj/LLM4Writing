package tw.com.slsinfo.essayai.models;


import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 學校學制
 */
public enum SchoolSystemType {

    ELEMENTARY("國民小學"),
    JUNIOR("國民中學"),
    SENIOR("一般高級中等學校"),
    UNIVERSITY("大專校院"),
    SPECIAL_EDUCATION("特殊教育學校");

    SchoolSystemType(String value) {
        this.value = value;
    }

    private String value;

    public String getValue() {
        return value;
    }


    /**
     * 以Stream方式取得全部Enum內容
     *
     * @return
     */
    public static List<SchoolSystemType> stream() {
        return Arrays.stream(SchoolSystemType.values()).toList();
    }

    /**
     * 以學制名取得學校資料
     *
     * @param system
     * @return
     */
    public static SchoolSystemType getSchoolSystemType(String system) {
        Optional<SchoolSystemType> optional = stream().stream()
                .filter(e -> e.getValue().equals(system)).findAny();
        return optional.orElse(null);
    }
}
