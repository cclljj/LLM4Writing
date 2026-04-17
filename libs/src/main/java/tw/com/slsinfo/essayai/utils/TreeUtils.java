package tw.com.slsinfo.essayai.utils;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.models.GenreType;


/**
 * GoJS Tree Json Structure Building Util
 */
public class TreeUtils {

    private static final Logger logger = LoggerFactory.getLogger(TreeUtils.class);
    private final ObjectMapper objectMapper;

    public TreeUtils() {
        objectMapper = new ObjectMapper();
    }


    /**
     * 加入子節點
     *
     * @param arr    欲新增的子節點
     * @param key    節點Key值
     * @param parent 父節點名稱（parent key）
     * @param text   顯示的文字
     * @param fixed  是否可修改
     */
    public void addNode(ArrayNode arr, String key, String parent, String text, boolean fixed) {
        ObjectNode objectNode = objectMapper.createObjectNode();
        objectNode.put("key", key);
        if (parent != null) objectNode.put(AIConstants.TREE_NODE_PARENT, parent);
        objectNode.put(AIConstants.TREE_NODE_TEXT, text);
        objectNode.put(AIConstants.TREE_NODE_FIXED, fixed);
        arr.add(objectNode);
    }

    /**
     * 回傳預設的Tree範本
     *
     * @param genre
     * @param title
     * @return
     */
    public String buildTemplateJson(GenreType genre, String title) {
        ArrayNode arr = objectMapper.createArrayNode();
        switch (genre) {
            case LYRICAL:
                addNode(arr, "root", null, "抒情文 - " + title, false);
                addNode(arr, "dot", "root", "點題", false);
                addNode(arr, "bg", "root", "背景", false);
                addNode(arr, "evt", "root", "事件", false);
                addNode(arr, "emo", "root", "抒情", false);
                addNode(arr, "end", "root", "收尾", false);
                // 樹狀sample
//                // 點題
//                addNode(arr, "dot_kw", "dot", "提及題目關鍵字", true);
//                // 背景
//                addNode(arr, "bg_time", "bg", "時間", true);
//                // 事件
//                addNode(arr, "evt_cause", "evt", "起因", true);
//                // 抒情
//                addNode(arr, "emo_final", "emo", "最後的感受或體悟", true);
//                // 收尾
//                addNode(arr, "end_sum", "end", "內容總結", true);
                break;
            case NARRATIVE:
                addNode(arr, "root", null, "記敘文 - " + title, false);
                addNode(arr, "bg", "root", "點題", false);
                addNode(arr, "evt", "root", "背景", false);
                addNode(arr, "emo", "root", "事件", false);
                addNode(arr, "result", "root", "結果", false);
                addNode(arr, "end", "root", "收尾", false);
                break;
            case EXPOSITORY:
                addNode(arr, "root", null, "說明文 - " + title, false);
                addNode(arr, "def", "root", "總說", false);
                addNode(arr, "parts", "root", "分說", false);
                addNode(arr, "sum", "root", "總說", false);
            case ARGUMENTATIVE:
                addNode(arr, "root", null, "說明文 - " + title, false);
                addNode(arr, "refer", "root", "引論", false);
                addNode(arr, "parts", "root", "本論", false);
                addNode(arr, "sum", "root", "結論", false);
                break;
        }
//        logger.debug("arr.toString() : {}", arr.toString());
        return arr.toString(); // pure JSON like: [{"key":"root","text":"...","fixed":true}, ...]
    }
}
