package tw.com.slsinfo.essayai.utils;


import com.openai.core.http.StreamResponse;
import com.openai.models.responses.*;
import org.apache.logging.log4j.util.Strings;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class OpenAIUtils {

    /**
     * 取出OutputText
     * @param response
     * @return
     */
    public static String getOutputText(Response response) {

//        StringBuilder outputText = new StringBuilder();
//
//        for (ResponseOutputItem output : response.output()) {
//            output.message().ifPresent(message -> {
//                for (ResponseOutputMessage.Content content : message.content()) {
//                    content.outputText().ifPresent(t -> {
//                        outputText.append(t.text());
//                    });
//                }
//            });
//        }
//        return outputText.toString();

        return response.output().stream()
                .map(ResponseOutputItem::message)                  // Optional<ResponseOutputMessage>
                .flatMap(Optional::stream)                         // 展開 Optional
                .flatMap(message -> message.content().stream())    // List<ResponseOutputMessage.Content>
                .map(ResponseOutputMessage.Content::outputText)    // Optional<ResponseOutputMessage.Content.OutputText>
                .flatMap(Optional::stream)                         // 展開 Optional
                .map(ResponseOutputText::text)                     // 取得 outputText
                .collect(Collectors.joining());
    }

    /**
     * 將串流回應 (StreamResponse<ResponseStreamEvent>) 轉成完整字串
     */
    public static String streamToText(StreamResponse<ResponseStreamEvent> streamResponse) {
        StringBuilder output = new StringBuilder();

        streamResponse.stream()
                .flatMap(event -> event.outputTextDelta().stream())  // Optional<ResponseTextDelta> → Stream<ResponseTextDelta>
                .map(ResponseTextDeltaEvent::delta)                  // 取出 delta()，這裡是 String
                .forEach(output::append);                            // 累積文字

        return output.toString();
    }

    /**
     * 擷取字串中的Json Array
     * @param text
     * @return
     */
    public static String extractJsonArray(String text) {
        String jsonArray = Strings.EMPTY;
        // 使用正則取得 [ ... ] 之間的內容
        Pattern pattern = Pattern.compile("\\[.*?\\]", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(text);

        if (matcher.find()) {
            jsonArray = matcher.group();
            System.out.println(jsonArray);
        } else {
            System.out.println("未找到 JSON 陣列");
        }
        return jsonArray;
    }
}
