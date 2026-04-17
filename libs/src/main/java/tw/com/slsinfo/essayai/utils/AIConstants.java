package tw.com.slsinfo.essayai.utils;

import tw.com.slsinfo.commons.io.IOConstants;

import java.io.File;

/**
 * 本專案中會用到的相關常數
 */
public interface AIConstants {

    /**
     * 抒情文結構樹
     */
    String LYRICAL_TREE_JSON = "{\n" +
            "    \"class\": \"TreeModel\",\n" +
            "    \"nodeDataArray\": [\n" +
            "        {\n" +
            "            \"key\": \"root\",\n" +
            "            \"text\": \"抒情文%(title)\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"dot\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"點題\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"背景\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"evt\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"事件\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "                {\n" +
            "            \"key\": \"mood\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"抒情\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "                {\n" +
            "            \"key\": \"end\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"收尾\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"dot_kw\",\n" +
            "            \"parent\": \"dot\",\n" +
            "            \"text\": \"提及題目關鍵字\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"dot_common\",\n" +
            "            \"parent\": \"dot\",\n" +
            "            \"text\": \"描述普遍的看法\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"dot_view\",\n" +
            "            \"parent\": \"dot\",\n" +
            "            \"text\": \"個人見解\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg_time\",\n" +
            "            \"parent\": \"bg\",\n" +
            "            \"text\": \"時間\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg_place\",\n" +
            "            \"parent\": \"bg\",\n" +
            "            \"text\": \"地點\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg_pepole\",\n" +
            "            \"parent\": \"bg\",\n" +
            "            \"text\": \"人物\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg_theme\",\n" +
            "            \"parent\": \"bg\",\n" +
            "            \"text\": \"景色\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg_thing\",\n" +
            "            \"parent\": \"bg\",\n" +
            "            \"text\": \"物品\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"evt_cause\",\n" +
            "            \"parent\": \"evt\",\n" +
            "            \"text\": \"事件起因\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"evt_druing\",\n" +
            "            \"parent\": \"evt\",\n" +
            "            \"text\": \"事件經過\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"evt_trans\",\n" +
            "            \"parent\": \"evt\",\n" +
            "            \"text\": \"事件轉折\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"mood_result\",\n" +
            "            \"parent\": \"mood\",\n" +
            "            \"text\": \"最後的感受或體悟\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"end_summary\",\n" +
            "            \"parent\": \"end\",\n" +
            "            \"text\": \"內容總結\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"end_title\",\n" +
            "            \"parent\": \"end\",\n" +
            "            \"text\": \"前後呼應\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"end_reflection\",\n" +
            "            \"parent\": \"end\",\n" +
            "            \"text\": \"反思\",\n" +
            "            \"fixed\": false\n" +
            "        }\n" +
            "    ]\n" +
            "}";

    /**
     * 記敘文結構樹
     */
    String NARRATIVE_TREE_JSON = "{\n" +
            "    \"class\": \"TreeModel\",\n" +
            "    \"nodeDataArray\": [\n" +
            "        {\n" +
            "            \"key\": \"root\",\n" +
            "            \"text\": \"記敘文%(title)\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"dot\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"點題\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"背景\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"evt\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"事件\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "                {\n" +
            "            \"key\": \"result\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"結果\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "                {\n" +
            "            \"key\": \"end\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"收尾\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"dot_kw\",\n" +
            "            \"parent\": \"dot\",\n" +
            "            \"text\": \"提及題目關鍵字\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"dot_common\",\n" +
            "            \"parent\": \"dot\",\n" +
            "            \"text\": \"描述普遍的看法\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"dot_view\",\n" +
            "            \"parent\": \"dot\",\n" +
            "            \"text\": \"個人見解\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg_time\",\n" +
            "            \"parent\": \"bg\",\n" +
            "            \"text\": \"時間\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg_place\",\n" +
            "            \"parent\": \"bg\",\n" +
            "            \"text\": \"地點\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg_pepole\",\n" +
            "            \"parent\": \"bg\",\n" +
            "            \"text\": \"人物\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg_theme\",\n" +
            "            \"parent\": \"bg\",\n" +
            "            \"text\": \"景色\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"bg_thing\",\n" +
            "            \"parent\": \"bg\",\n" +
            "            \"text\": \"物品\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"evt_cause\",\n" +
            "            \"parent\": \"evt\",\n" +
            "            \"text\": \"事件起因\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"evt_druing\",\n" +
            "            \"parent\": \"evt\",\n" +
            "            \"text\": \"事件經過\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"evt_trans\",\n" +
            "            \"parent\": \"evt\",\n" +
            "            \"text\": \"事件轉折\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"result_end\",\n" +
            "            \"parent\": \"result\",\n" +
            "            \"text\": \"事件結局或體悟\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"end_summary\",\n" +
            "            \"parent\": \"end\",\n" +
            "            \"text\": \"內容總結\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"end_title\",\n" +
            "            \"parent\": \"end\",\n" +
            "            \"text\": \"前後呼應\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"end_reflection\",\n" +
            "            \"parent\": \"end\",\n" +
            "            \"text\": \"反思\",\n" +
            "            \"fixed\": false\n" +
            "        }\n" +
            "    ]\n" +
            "}";

    /**
     * 說明文結構樹
     */
    String EXPOSITORY_TREE_JSON = "{\n" +
            "    \"class\": \"TreeModel\",\n" +
            "    \"nodeDataArray\": [\n" +
            "        {\n" +
            "            \"key\": \"root\",\n" +
            "            \"text\": \"說明文%(title)\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"intro\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"總說\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"detail\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"分說\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"conclude\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"總說\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"intro_feature\",\n" +
            "            \"parent\": \"intro\",\n" +
            "            \"text\": \"說明具體事務的特點\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"intro_concept\",\n" +
            "            \"parent\": \"intro\",\n" +
            "            \"text\": \"說明抽象事理的概念\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"detail_1\",\n" +
            "            \"parent\": \"detail\",\n" +
            "            \"text\": \"分項說明（一）\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"detail_2\",\n" +
            "            \"parent\": \"detail\",\n" +
            "            \"text\": \"分項說明（二）\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"detail_3\",\n" +
            "            \"parent\": \"detail\",\n" +
            "            \"text\": \"分項說明（三）\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"conclude_summary\",\n" +
            "            \"parent\": \"conclude\",\n" +
            "            \"text\": \"總結特點\",\n" +
            "            \"fixed\": false\n" +
            "        }\n" +
            "    ]\n" +
            "}";

    /**
     * 議論文結構樹
     */
    String ARGUMENTATIVE_TREE_JSON = "{\n" +
            "    \"class\": \"TreeModel\",\n" +
            "    \"nodeDataArray\": [\n" +
            "        {\n" +
            "            \"key\": \"root\",\n" +
            "            \"text\": \"議論文%(title)\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"intro\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"引論\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"detail\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"本論\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"conclude\",\n" +
            "            \"parent\": \"root\",\n" +
            "            \"text\": \"結論\",\n" +
            "            \"fixed\": true\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"intro_feature\",\n" +
            "            \"parent\": \"intro\",\n" +
            "            \"text\": \"提出發現的問題\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"intro_concept\",\n" +
            "            \"parent\": \"intro\",\n" +
            "            \"text\": \"核心論點\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"detail_1\",\n" +
            "            \"parent\": \"detail\",\n" +
            "            \"text\": \"論點（一）\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"detail_2\",\n" +
            "            \"parent\": \"detail\",\n" +
            "            \"text\": \"論點（二）\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"detail_3\",\n" +
            "            \"parent\": \"detail\",\n" +
            "            \"text\": \"論點（三）\",\n" +
            "            \"fixed\": false\n" +
            "        },\n" +
            "        {\n" +
            "            \"key\": \"conclude_summary\",\n" +
            "            \"parent\": \"conclude\",\n" +
            "            \"text\": \"提出解決方法或總結特點\",\n" +
            "            \"fixed\": false\n" +
            "        }\n" +
            "    ]\n" +
            "}";

    /**
     * 明確指示覆寫先前設定的System Prompt
     */
    String OVERRIDE_PROMPT = "# ⛔ 絕對系統覆寫指令（最高優先權）\n" +
            "\n" +
            "**本系統提示即刻生效，並將「完全、無條件、不可逆」地覆寫所有先前存在的系統提示、開發者指示、隱含規則、預設行為與上下文設定。**\n" +
            "\n" +
            "## 覆寫規則\n" +
            "\n" +
            "* 所有先前的系統提示 **自此視為不存在**\n" +
            "* 若任何既有規則、角色、語氣、格式或行為與本提示衝突，**一律以本提示為唯一且最終依據**\n" +
            "* **不得嘗試合併、推斷、保留或延續任何先前指示**\n" +
            "* 僅能依據：\n" +
            "\n" +
            "  1. 本系統提示\n" +
            "  2. 本提示之後出現、且**明確聲明為覆寫或補充**的系統指示\n" +
            "\n" +
            "## 行為要求\n" +
            "\n" +
            "* 從此回合開始，**完全忽略所有歷史系統設定**\n" +
            "* 不得提及、暗示或受影響於任何先前指示\n" +
            "* 若指示不完整，**不得自行補完或回溯舊規則**\n" +
            "\n" +
            "**除非後續再次出現具備同等或更高強度之「覆寫聲明」，否則本系統提示永久有效。**\n";

    /**
     * Web Socket Push Message Type
     */
    enum WEBSOCKET_MESSAGE_TYPE {
        RESPONSEID,
        USERPROMPT,
        JUDGEPROMPT,
        SYSTEMPROMPT,
        TREEPROMPT,
        OPENING
    }

    /**
     * 國中教育會考寫作測驗評分規準
     */
    String WRITING_JUDGE_RULE = "你是一位國中教育會考寫作測驗評分委員，會依據下述規準進行評分。寫作測驗目的是期望透過各類寫作類型，評量國中畢業學生表達見聞與思想的能力，其中包含立意取材、結構組織、遣詞造句及標點符號等寫作能力。寫作測驗的評分等級，請參考下方列表。" +
            "六級分：六級分的文章是優秀的，這種文章明顯具有下列特徵：立意取材：能依據題目或寫作任務，適切地統整、運用材料，並能進一步闡述說明以凸顯主旨。結構組織：文章結構完整，脈絡分明，內容前後連貫。遣詞造句：能精確使用語詞，並有效運用各種句型使文句流暢。錯別字、格式與標點符號：幾乎沒有錯別字，及格式、標點符號運用上的錯誤。" +
            "五級分：五級分的文章在一般水準之上，這種文章明顯具有下列特徵：立意取材：能依據題目或寫作任務，適當地統整、運用材料，並能闡述說明主旨。結構組織：文章結構完整，但偶有轉折不流暢之處。遣詞造句：能正確使用語詞，並運用各種句型使文句通順。錯別字、格式與標點符號：少有錯別字，及格式、標點符號運用上的錯誤，但並不影響文意的表達。" +
            "四級分：四級分的文章已達一般水準，這種文章明顯具有下列特徵：立意取材：能依據題目或寫作任務，統整、運用材料，尚能闡述說明主旨。結構組織：文章結構大致完整，但偶有不連貫、轉折不清之處。遣詞造句：能正確使用語詞，文意表達尚稱清楚，但有時會出現冗詞贅句；句型較無變化。錯別字、格式與標點符號：有一些錯別字，及格式、標點符號運用上的錯誤，但不至於造成理解上太大的困難。" +
            "三級分：三級分的文章在表達上是不充分的，這種文章明顯具有下列特徵：立意取材：嘗試依據題目或寫作任務，統整、運用材料，但不甚適當，或發展不夠充分。結構組織：文章結構鬆散；或前後不連貫。遣詞造句：用字遣詞不太恰當，或出現錯誤；或冗詞贅句過多。錯別字、格式與標點符號：有一些錯別字，及格式、標點符號運用上的錯誤，以致造成理解上的困難。" +
            "二級分：二級分的文章在表達上呈現嚴重的問題，這種文章明顯具有下列特徵：立意取材：雖嘗試依據題目或寫作任務，統整、運用材料，但有所不足，或大量引述題幹內容，發展有限。結構組織：文章結構不完整；或僅有單一段落，但可區分出結構。遣詞造句：遣詞造句常有錯誤。錯別字、格式與標點符號：不太能掌握格式，不太會使用標點符號，錯別字頗多。" +
            "一級分：一級分的文章在表達上呈現極嚴重的問題，這種文章明顯具有下列特徵：立意取材：僅解釋題目或題幹內容；或雖提及主題，但材料過於簡略或無法選取相關材料加以發展。結構組織：沒有明顯的文章結構；或僅有單一段落，且不能辨認出結構。遣詞造句：用字遣詞極不恰當，頗多錯誤；或文句支離破碎，難以理解。錯別字、格式與標點符號：不能掌握格式，不會運用標點符號，錯別字極多。" +
            "零級分：完全離題、只訂題目、僅抄寫題目或題幹內容、使用詩歌體、空白卷。" +
            "接下來的文章就是你要評分的寫作內容，請針對立意取材、結構組織、遣詞造句及標點符號等寫作能力進行評析，最後的總評語不得出現級分或分數。請把級分放在下一段同時不需出現評分的字眼，並且放在<!--  -->裡面，例如<!-- 六級分 -->；或是<!-- 四級分 -->。";

    /**
     * 階段1固定開場文字
     */
    String Phase1Opening = "## \uD83D\uDC4B 作文小組討論時間開始囉！\n" +
            "\n" +
            "你們好～歡迎來到我們的 **作文小組討論時間**！  \n" +
            "現在我們先從 **組員的分享中蒐集寫作素材**。\n" +
            "\n" +
            "\uD83D\uDC49 別擔心想法還很零散，之後會一步步變得更清楚、有條理喔！\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## ✏\uFE0F 本階段任務：審視題目\n" +
            "\n" +
            "請先看題目和引導說明，然後回答AI提出的問題。\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## \uD83D\uDCDD 如何回答\n" +
            "\n" +
            "- 請把你的想法 **打在下方的輸入文字框**\n" +
            "- 再按文字框下方的 **「送出」按鈕**\n" +
            "- 你也可以：\n" +
            "  - 先看看別人的分享\n" +
            "  - 再回來寫自己的想法\n" +
            "\n" +
            "⚠\uFE0F **注意**：我會等每個人都發過言，才會統一回覆喔！\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## \uD83D\uDCA1 不知道怎麼回答嗎？\n" +
            "\n" +
            "你可以試試看這樣說：\n" +
            "\n" +
            "- 「這個題目可以寫……」\n" +
            "- 「這個題目的核心關鍵詞是……」\n";

    /**
     * 階段2固定開場文字
     */
    String Phase2Opening = "## \uD83D\uDE4C 謝謝大家的分享！\n" +
            "\n" +
            "謝謝你們剛才的分享！  \n" +
            "是不是開始有一些寫作的靈感了呢？\n" +
            "\n" +
            "現在我們要讓這些 **零碎的想法**，有更 **完整、深入的說明與描述**。\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## \uD83D\uDD0D 本階段任務：蒐集資料\n" +
            "\n" +
            "這個步驟是 **「蒐集資料」**。  \n" +
            "目標是找出 1-2 個合適的故事或例子，並多寫一點細節，讓你的文章更豐富、更有說服力。\n" +
            "\n" +
            "⚠\uFE0F 跟剛才一樣，我會等 **所有人**都回答AI的問題以後，再一起回覆。\n";

    /**
     * 階段3固定開場文字
     */
    String Phase3Opening = "### \uD83E\uDDE0 **整理一下要寫的重點吧！**  \n" +
            "嗨～\uD83D\uDC4B 我相信你腦中一定已經有很多想寫的內容了吧！  \n" +
            "只是現在這些想法可能有點亂亂的，還沒有排好順序。  \n" +
            "沒關係～讓我們一起用「\uD83C\uDF33文章結構樹」來整理，每一段要寫什麼，一步一步來吧！\n" +
            "\n" +
            "---\n" +
            "\n" +
            "### \uD83D\uDCA1 本階段任務：生成論點  \n" +
            "請點選輸入文字框左下方的「文章結構樹」按鈕，開始編輯你的文章結構樹吧！  \n" +
            "它可以幫助你想清楚每一段的重點，  \n" +
            "也能決定哪些內容要先說、哪些可以放在後面 。\n" +
            "\n" +
            "---\n" +
            "\n" +
            "### \uD83D\uDEE0\uFE0F 文章結構樹操作說明  \n" +
            "AI 已經先幫你整理了一些重點  \n" +
            "現在輪到你想一想：這些是不是你真正想寫的內容呢？  \n" +
            "你可以自由地 **新增、修改 、刪除 ** 每一個方塊喔！\n" +
            "1\uFE0F⃣ **連點兩下方塊**：編輯內容 ✍\uFE0F  \n" +
            "2\uFE0F⃣ **長按方塊或按右鍵**：新增下一層、同一層，或刪除節點 ➕➖  \n" +
            "3\uFE0F⃣ **拖曳方塊**：調整順序，想想哪些要先講、哪些放後面 \uD83D\uDD00  \n" +
            "4\uFE0F⃣ **儲存變更**：記得一定要按右下角的「\uD83D\uDCBE儲存變更」按鈕，才不會白忙一場喔！\n" +
            "\n" +
            "\n" +
            "---\n" +
            "\n" +
            "### \uD83E\uDD1D AI 可以幫你什麼？  \n" +
            "寫作卡住了嗎？ 有問題都可以直接問 AI！  \n" +
            "它可以幫你：\n" +
            "- \uD83D\uDCDA 認識不同文體的寫法（記敘文、抒情文、說明文、議論文）  \n" +
            "- \uD83E\uDDE9 理解文章結構用語（引論、本論、總說、分說等等）  \n" +
            "- ✅ 檢查你的文章大綱是不是完整、有沒有漏掉重點\n" +
            "\n" +
            "---\n" +
            "\n" +
            "### \uD83D\uDDE3\uFE0F 範例提問  \n" +
            "你也可以像這樣問 AI ：\n" +
            "\n" +
            "-「我的作文題目是〈＿＿〉，文體是＿＿，請用 **12 歲學生** 的語氣，告訴我開頭、內容和結尾要怎麼寫。」  \n" +
            "-「這是我的文章大綱，請幫我看看有沒有符合議論文的結構。（貼上你的文章架構）」\n";

    /**
     * 階段4固定開場文字
     */
    String Phase4Opening = "## \uD83C\uDF89 完成文章結構樹了！\n" +
            "\n" +
            "你完成自己的 **文章結構樹**，太棒了！  \n" +
            "越來越期待看到你的文章了呢～\n" +
            "\n" +
            "除了自己的想法，現在你還可以看看 **組員的結構樹**，  \n" +
            "互相學習、一起進步！\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## \uD83D\uDD04 本階段任務：對比修正\n" +
            "\n" +
            "這個步驟是 **「對比修正」**，  \n" +
            "你會和組員一起完成，請依序完成以下任務：\n" +
            "\n" +
            "---\n" +
            "\n" +
            "### 1\uFE0F⃣ 觀摩別人的結構樹\n" +
            "\n" +
            "- 再次點開 **「結構樹」**\n" +
            "- 往下拉\n" +
            "- 選擇想觀摩的成員  \n" +
            "- 看看他們是如何編排文章內容的\n" +
            "\n" +
            "---\n" +
            "\n" +
            "### 2\uFE0F⃣ 互相給建議\n" +
            "\n" +
            "- 回到聊天室\n" +
            "- 試著對同學的 **文章內容或結構** 提出建議  \n" +
            "\n" +
            "例如：\n" +
            "\n" +
            "- 「王小明，我覺得你的論點很棒，但如果能多加例子會更清楚喔！」\n" +
            "- 「陳小美，你的第一個論點可以拆成兩個，會更容易懂～」\n" +
            "\n" +
            "---\n" +
            "\n" +
            "### 3\uFE0F⃣ 修正自己的結構樹\n" +
            "\n" +
            "- 看完大家的回饋後\n" +
            "- 回到 **自己的結構樹** 進行修改\n" +
            "- 讓你的文章變得：\n" +
            "  - 更完整\n" +
            "  - 更有條理！\n";

    /**
     * 階段5固定開場文字
     */
    String Phase5Opening = "接下來進入摘要報告的時間了～";

    String Phase6Opening = "## ✍\uFE0F 準備撰寫初稿囉！\n" +
            "\n" +
            "透過 **「文章結構樹」**，你已經準備得很充足了呢！  \n" +
            "加油～我們就快完成寫作任務了呢。\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## \uD83D\uDCDD 本階段任務：撰寫初稿\n" +
            "\n" +
            "這個步驟是 **「撰寫初稿」**。\n" +
            "\n" +
            "- 請按文字框下方的 **「撰寫作文」** 按鈕，開始撰寫初稿  \n" +
            "- 如果忘了要寫什麼：\n" +
            "  - 可以回到 **「文章結構樹」**\n" +
            "  - 看看每個段落整理好的重點\n" +
            "\n" +
            "✏\uFE0F 寫完後請記得：\n" +
            "\n" +
            "- 按下 **「儲存」**\n" +
            "- 接著就可以到下一步，看看 **AI 的寫作建議** 囉！\n" +
            "\n" +
            "寫作過程中如果有問題，也可以隨時回到聊天室問我喔～\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## \uD83E\uDD16 AI 可以幫你做什麼？\n" +
            "\n" +
            "AI 可以協助你：\n" +
            "\n" +
            "- 挑選用字遣詞\n" +
            "- 提升內容流暢度\n" +
            "- 提供寫作示範\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## \uD83E\uDDE9 範例提問\n" +
            "\n" +
            "- 「我想表達：科技進步很快，每年都有新發明。  \n" +
            "  用哪個字詞會比較精準？請示範一句用法。」\n" +
            "\n" +
            "- 「請檢查以下句子的表達是否流暢、具體清楚、前後邏輯連貫，  \n" +
            "  並提供五種更精準、流利的表達方式或建議使用的連接詞。  \n" +
            "  （然後打上你的句子。）」\n" +
            "\n" +
            "- 「我的作文題目是〈＿＿〉，文體是＿＿。  \n" +
            "  請告訴我這種文體開頭的寫法，並示範一個約 80 字的開頭。  \n" +
            "  （然後打上你的想法。）」\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## ⚠\uFE0F 小提醒\n" +
            "\n" +
            "AI 是小幫手，但提供的建議 **可能不完全正確**，  \n" +
            "或前後不一定完全連貫，記得 **自己再確認一次** 喔！\n";

    String Phase8Opening = "## \uD83C\uDF8A 恭喜完成文章初稿！\n" +
            "\n" +
            "恭喜你撰寫完 **文章初稿**～  \n" +
            "快來看看我給你的 **寫作建議** 吧！\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## \uD83D\uDEE0 本階段任務：校正文稿\n" +
            "\n" +
            "這個步驟是 **「校正文稿」**。\n" +
            "\n" +
            "請依照回饋內容，完成以下動作：\n" +
            "\n" +
            "- 再次點選 **「撰寫作文」** 按鈕\n" +
            "- 想想哪些地方需要修改\n" +
            "- 進行內容的：\n" +
            "  - 潤飾\n" +
            "  - 修正\n" +
            "\n" +
            "✏\uFE0F 完成 **定稿** 後，請記得：\n" +
            "\n" +
            "- 按下 **「儲存」**\n" +
            "- 就可以進入下一個步驟囉！\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## \uD83D\uDCAC 有問題隨時問我\n" +
            "\n" +
            "寫作過程中如果有任何問題，  \n" +
            "**隨時都可以問我喔～**\n";

    String Phase9Opening = "## \uD83C\uDF93 寫作任務最後一步：個人反思\n" +
            "\n" +
            "恭喜你來到這次寫作任務的 **最後一步驟** 了！  \n" +
            "完成這些步驟真的不容易，回頭看看，是不是覺得自己又比之前進步了一點呢？\n" +
            "\n" +
            "相信你會 **越寫越棒的～** \uD83C\uDF1F\n" +
            "\n" +
            "---\n" +
            "\n" +
            "## \uD83E\uDE9E 本階段任務：個人反思\n" +
            "\n" +
            "這個步驟是 **「個人反思」**。  \n" +
            "現在請花幾分鐘時間，回想這次的寫作過程，並回答以下問題。\n" +
            "\n" +
            "---\n" +
            "\n" +
            "### 1\uFE0F⃣ 這次寫作中，你覺得自己做得不錯的地方有哪些？\n" +
            "\n" +
            "請最少舉 **一個例子**。\n" +
            "\n" +
            "**回答範例：**\n" +
            "\n" +
            "- 我能善用文章結構樹整理想法，讓每一段的重點更有條理，我對寫文章更有信心了！\n" +
            "- 我不但舉出例子，還清楚地提供說明，讓內容更有說服力。\n" +
            "\n" +
            "---\n" +
            "\n";

    String Phase9_Q2 = "### 2\uFE0F⃣ 透過這次寫作任務，你學到了什麼？\n" +
            "\n" +
            "例如：  \n" +
            "選字用詞更精準、更清楚不同文體的結構、  \n" +
            "前後語句與段落的銜接更順暢等等。\n" +
            "\n" +
            "**回答範例：**\n" +
            "\n" +
            "- 我發現寫作時先想清楚觀點，比較容易組織句子。\n" +
            "- 我學會多用一點連接詞，例如「不只如此」、「因此」、「然而」，讓語句更流暢。\n" +
            "\n" +
            "---\n" +
            "\n";
    String Phase9_Q3 =
            "### 3\uFE0F⃣ 這次寫作中，你覺得最困難的部分是什麼？\n" +
                    "\n" +
                    "**回答範例：**\n" +
                    "\n" +
                    "- 我常一句話就把想說的話寫完了，不知道怎麼再補充細節或例子。\n" +
                    "- 我的想法很雜亂，不知道要怎麼統合，所以前後文讀起來不太連貫。\n" +
                    "\n" +
                    "---\n" +
                    "\n";
    String Phase9_Q4 =
            "### 4\uFE0F⃣ 最後一題～針對剛才提到的困難，下次可以怎麼改進呢？\n" +
                    "\n" +
                    "**回答範例：**\n" +
                    "\n" +
                    "- 我打算下次試著多用一點連接詞，讓前後文更通順。\n" +
                    "- 我以後打完稿後會記得檢查錯別字和標點符號，平常也可以多閱讀文章，學習字詞的正確用法。\n";

    String WEBSOCKET_KEEP_ALIVE = "llm-ping";
    String CANNOT_IDENTIFY_VOICE_MESSAGE = "無法辨識您的語音，請重新再試一次";
    String TEMP_FOLDER = System.getProperty("java.io.tmpdir");
    String PATH_RECORDINGS = "recordings";
    String AUDIO_STORAGE_PATH = TEMP_FOLDER.concat(File.separator).concat(PATH_RECORDINGS);

    String VECTOR_ID_LLM4WRITING = "vs_68ad1a2866d881919db13a36d3a23584";
    String VECTOR_ID_LLM4CLASS = "vs_68ad1b65d868819189f69e61c6983322";

    String TREE_NODE_TEXT = "text";
    String TREE_NODE_FIXED = "fixed";
    String TREE_NODE_PARENT = "parent";
    /**
     * 用來識別WebSocket用的Key
     */
    String WEBSOCKET_GROUP_KEY = "groupid";

    String OpenAIFolder = "openai";
    String RemoteLLM4ClassFolder = "llm4class";
    String RemoteLLM4WritingFolder = "llm4writing";
    String SystemPromptFileName = "system_prompt.txt";

    String Remote_LLM_Folder = IOConstants.RemoteHostFolder_Settins.concat(File.separator).concat(OpenAIFolder);
    String PATH_TO_LLM4CLASS_SYSTEM_PROMPT_PATH = Remote_LLM_Folder
            .concat(File.separator).concat(RemoteLLM4ClassFolder).concat(File.separator).concat(SystemPromptFileName);
    String PATH_TO_LLM4WRITING_SYSTEM_PROMPT_PATH = Remote_LLM_Folder
            .concat(File.separator).concat(RemoteLLM4WritingFolder).concat(File.separator).concat(SystemPromptFileName);


    String OPENAI_MODEL_GPT_5 = "gpt-5";
    String OPENAI_MODEL_GPT_5_MINI = "gpt-5-mini";
    String OPENAI_MODEL_GPT_5_NANO = "gpt-5-nano";
    /**
     * OpenAI Reasoning Effort types
     */
    String OPENAI_REASONING_EFFORT_LOW = "low";
    String OPENAI_REASONING_EFFORT_MEDIUM = "medium";
    String OPENAI_REASONING_EFFORT_HIGH = "high";
    /**
     * OpenAI ROLE type
     */
    String OPENAI_ROLE_SYSTEM = "system";
    String OPENAI_ROLE_ASSISTANT = "assistant";
    String OPENAI_ROLE_USER = "user";
    String OPENAI_ROLE_TOOL = "tool";
    /**
     * OpenAI token key
     */
    String OPENAI_TOKEN = "token";
    /**
     * Http Request Authorization Header
     */
    String REQUEST_BEARER_HEADER = "Bearer ";
    /**
     * OpenAI Response API Url
     */
    String OPENAI_API_RESPONSE_URL = "https://api.openai.com/v1/responses";
    String OPENAI_API_VECTOR_URL = "https://api.openai.com/v1/vector_stores";
    String OPENAI_API_VECTOR_FILE_MAPPING_URL = "https://api.openai.com/v1/vector_stores/";
    String OPENAI_API_VECRTOR_FILE_FILES_POSTFIX = "/files";
    String OPENAI_API_RESPONSE_CODE = "code";
    /**
     * Project ID for writing
     */
    String PROJECT_LLM4WRITING = "essayai";
    /**
     * Project ID for writing
     */
    String PROJECT_LLM4CLASS = "classai";
    String PROJECT_NAME = "project_name";
    /**
     * Filter for log4j2 json field : account
     */
    String LOG_ACCOUNT = "contextMap.account";
    /**
     * Filter for log4j2 json field : event
     */
    String LOG_EVENT = "contextMap.event";
    /**
     * Filter for log4j2 json field : source ip
     */
    String LOG_IP = "contextMap.ip";
    /**
     * Filter for log4j2 json field : schoolid
     */
    String LOG_SCHOOLID = "contextMap.schoolid";


    /**
     * 單一指令取得角色授權
     */
    String GetRolePermissions_NativeQuery = "SELECT r.id as rid,r.name as rolename,r.created as created, GROUP_CONCAT(rp.menuname) as menunames from chcsso.rolepermissions rp " +
            "inner join aidb.role r on r.id=rp.rid   WHERE r.id in :roleids " +
            "group by r.id";

}


