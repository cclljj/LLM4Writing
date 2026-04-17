package tw.com.slsinfo.essayai.utils;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.apache.wicket.Page;
import org.apache.wicket.model.IModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.LogModel;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.ServiceType;
import tw.com.slsinfo.essayai.models.GenreType;
import tw.com.slsinfo.essayai.models.openai.OpenAIInputModel;
import tw.com.slsinfo.essayai.openai.LLMSystemPromptLoaderSingleton;

import java.util.*;
import java.io.*;
import java.lang.reflect.Constructor;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;


/**
 * CHC SSO網頁工具
 */
public class WebUtils {

    private static final Logger logger = LoggerFactory.getLogger(WebUtils.class);

    public static final int init_year = 2025;
    public static final String properties = "chcsso.properties";
    public static final String BASE_PROP_DIR = "/opt/settings/";
    public static final String LOCAL_PROP_DIR = "/Users/wet_fish/Documents/Docker/cyportal";


    private WebUtils() {
    }

    /**
     * 解析級分
     *
     * @param judgeresponse
     * @return
     */
    public static String parseGrades(String judgeresponse) {
        Pattern pattern = Pattern.compile("<!--(.*?)-->", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(judgeresponse);
        List<String> comments = new ArrayList<>();
        while (matcher.find()) {
            comments.add(matcher.group(1).trim());
        }
        if (comments.isEmpty()) {
            return "無法評分";
        } else {
            return comments.get(0);
        }
    }

    /**
     * LLM4Class Default System Prompt
     *
     * @return
     */
    public static OpenAIInputModel getLLM4ClassSystemPromptModel() {
        OpenAIInputModel openAIInputModel = new OpenAIInputModel();
        openAIInputModel.setRole(AIConstants.OPENAI_ROLE_SYSTEM);
        openAIInputModel.setContent(
                LLMSystemPromptLoaderSingleton.INSTANCE.getSystemPrompt(AIConstants.RemoteLLM4ClassFolder)
        );
        return openAIInputModel;
    }

    /**
     * LLM4Writing Default System Prompt
     *
     * @return
     */
    public static OpenAIInputModel getLLM4WritingSystemPromptModel() {
        OpenAIInputModel openAIInputModel = new OpenAIInputModel();
        openAIInputModel.setRole(AIConstants.OPENAI_ROLE_SYSTEM);
        openAIInputModel.setContent(
                LLMSystemPromptLoaderSingleton.INSTANCE.getSystemPrompt(AIConstants.RemoteLLM4WritingFolder)
        );
        return openAIInputModel;
    }


    /**
     * 從Mongo中取得LLM4Writing日誌
     *
     * @param uid
     * @param eventType
     * @param ip
     * @param schoolid
     * @return
     */
    public static Map<String, String> getLLMWritingLogModelMap(String uid, EventType eventType, String ip, String schoolid) {
        return getLogModelMap(uid, eventType, ip, ServiceType.LLM4Writing, schoolid);
    }


    /**
     * 從Mongo中取得日誌
     *
     * @param uid
     * @param eventType
     * @param ip
     * @param schoolid
     * @param target
     * @return
     */
    public static Map<String, String> getLLMWritingLogModelMap(String uid, EventType eventType, String ip, String schoolid, String target) {
        return getLogModelMap(uid, eventType, ip, ServiceType.LLM4Writing, schoolid, target);

    }


    /**
     * 從Mongo中取得日誌
     *
     * @param uid
     * @param eventType
     * @param ip
     * @param serviceType
     * @param schoolid
     * @return
     */
    public static Map<String, String> getLogModelMap(String uid, EventType eventType, String ip, ServiceType serviceType, String schoolid) {
        return getLogModelMap(uid, eventType, ip, serviceType, null, schoolid);
    }

    /**
     * 從Mongo中取得日誌
     *
     * @param uid
     * @param eventType
     * @param ip
     * @param serviceType
     * @param target
     * @param schoolid
     * @return
     */
    public static Map<String, String> getLogModelMap(String uid, EventType eventType, String ip, ServiceType serviceType, String target, String schoolid) {
        LogModel logModel = new LogModel();
        logModel.setAccount(uid);
        logModel.setIp(ip);
        logModel.setService(serviceType);
        logModel.setEvent(eventType);
        logModel.setSchoolid(schoolid);
        logModel.setTarget(target);
        ObjectMapper objectMapper = new ObjectMapper();
        return objectMapper
                .convertValue(logModel, new TypeReference<Map<String, String>>() {
                });
    }

    /**
     * 送出URL Encoded字串
     *
     * @param source
     * @return
     */
    public static Optional<String> getEncodedURL(String source) {
        return Optional.ofNullable(URLEncoder.encode(source, StandardCharsets.UTF_8));
    }


    /**
     * 計算學年度 從九月份開始算
     */

    public static int getSemester() {
        LocalDate localDate = LocalDate.now();
        if (localDate.getMonthValue() > 7) {
            return localDate.getYear();
        } else {
            return localDate.getYear() - 1;
        }
    }

    /**
     * 計算學年度 從九月份開始算
     */

    public static int getSemester(int year) {
        if (LocalDate.now().getMonthValue() > 7) {
            return year;
        } else {
            return year - 1;
        }
    }

    /**
     * 隱碼電子郵件
     *
     * @param email
     * @return
     */
    public static String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return email;
        }
        String[] parts = email.split("@");
        String user = parts[0];
        String domain = parts[1];

        String maskedUser = user.length() <= 2
                ? user.charAt(0) + "•"
                : user.substring(0, 2) + "•".repeat(Math.max(0, user.length() - 2));

        // domain 處理：保留前三個字母與完整的 domain suffix（如 .com/.net）
        int dotIndex = domain.lastIndexOf('.');
        String domainName = dotIndex > 0 ? domain.substring(0, dotIndex) : domain;
        String domainSuffix = dotIndex > 0 ? domain.substring(dotIndex) : "";

        String maskedDomain = domainName.length() <= 3
                ? domainName + "•"
                : domainName.substring(0, 3) + "•".repeat(domainName.length() - 3);

        return maskedUser + "@" + maskedDomain + domainSuffix;
    }

    /**
     * 通用隱碼電子郵件（可設定帳號保留幾碼、是否顯示完整網域）
     *
     * @param email      電子郵件地址
     * @param keepPrefix 帳號部分保留前幾個字元（最少1）
     * @param showDomain 是否完整顯示 domain（true:顯示, false:隱藏為 ***.***）
     * @return 隱碼後的 email 字串
     */
    public static String maskEmail(String email, int keepPrefix, boolean showDomain) {
        if (email == null || !email.contains("@")) {
            return email;
        }

        String[] parts = email.split("@", 2);
        String user = parts[0];
        String domain = parts[1];

        // 帳號遮蔽處理
        int prefix = Math.min(Math.max(keepPrefix, 1), user.length());
        String visibleUser = user.substring(0, prefix);
        String maskedUser = visibleUser + "•".repeat(user.length() - prefix);

        // Domain 處理：全顯示或全隱藏
        String maskedDomain = showDomain ? domain : "•.•";

        return maskedUser + "@" + maskedDomain;
    }

    /**
     * 動態取得下一個活動頁面Page Class
     *
     * @param stageid
     * @return
     */
    public static Optional<Constructor<? extends Page>> getNextPage(int stageid) {
        StringBuffer pageclassname = new StringBuffer();
        pageclassname.append("tw.com.slsinfo.apps.course.phase").append(".Phase")
                .append(stageid).append("Page");
        try {
            Class<?> clazz = Class.forName(pageclassname.toString());
            if (Page.class.isAssignableFrom(clazz)) {
                Class<? extends Page> pageClass = (Class<? extends Page>) clazz;
                return Optional.of(pageClass.getDeclaredConstructor(IModel.class, int.class));
            } else {
                return Optional.empty();
            }
        } catch (ClassNotFoundException | NoSuchMethodException e) {
            throw new RuntimeException(e);
        }
    }

}
