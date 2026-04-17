package tw.com.slsinfo.tests;

import com.openai.core.JsonValue;
import com.openai.models.ChatModel;
import com.openai.models.audio.AudioModel;
import com.openai.models.files.FilePurpose;
import com.openai.models.responses.Response;
import com.openai.models.responses.ResponseInputItem;
import jakarta.json.Json;
import org.apache.logging.log4j.util.Strings;
import org.junit.jupiter.api.Test;
import org.junit.platform.commons.util.StringUtils;
import tw.com.slsinfo.essayai.models.openai.*;
import tw.com.slsinfo.essayai.services.OpenAIAPIService;
import tw.com.slsinfo.essayai.utils.OpenAIUtils;

import java.io.File;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

public class APITest {

    //@Test
    void postResponse() {

        ChatRequestModel rqModel = new ChatRequestModel();

        ReasoningModel reasoning = new ReasoningModel();
        reasoning.setEffort("medium");

        OpenAIInputModel input = new OpenAIInputModel();
        input.setRole("assistant");
        input.setContent("請根據「重點整理說明」，產出所需資料。");

        OpenAIInputModel input2 = new OpenAIInputModel();
        input2.setRole("user");
        input2.setContent("我不記得我什麼時候開始我變的很愛幻想事，在幻想的過程中我都把自己想的是最完美的一個或者讓自己變的很奇怪，我每次都是這樣幻想，卻不知道從何開始，我覺得這樣天馬行空是一件好事，雖然那是虛幻的，但卻如此逼真，我希望有一天能夠成為真正的幻想中的人。");

        ToolsModel tools = new ToolsModel();
        tools.setType("file_search");
        tools.setVectorStoreIds(List.of("vs_689d4b512c948191b3533d7c05694466"));
        tools.setMaxNumResults(10);

        rqModel.setModel("gpt-5");
        rqModel.setReasoning(reasoning);
        rqModel.setInput(List.of(input, input2));
        rqModel.setTools(List.of(tools));

        ChatResponseModel rsModel = OpenAIAPIService.postResponse(rqModel);

    }

    //@Test
    void uploadFile() {

        FileRequestModel rqModel = new FileRequestModel();

        File file = new File("/Users/devices.rd/Downloads/BAEE5200969E5AABFD042CBFC9D98A84D0F1E0C8_寫作平台中各步驟prompt.docx");

        rqModel.setFile(file);
        rqModel.setPurpose("assistants");

        System.out.println(OpenAIAPIService.uploadFile(file, FilePurpose.ASSISTANTS).id());

//        FileRSModel rsModel = OpenAIAPIService.postFile(rqModel);

//        System.out.println(rsModel.getId());
    }

    //@Test
    void postVectorFile() {
        String vid = "vs_68a3e5fafd8481918de64ee1c3d9d3d6";
        String fid = "file-8xr3whYJKdwdJth7KNxBpc";
        System.out.println(OpenAIAPIService.postVectorFile(vid, fid));
    }

//    @Test
    void createResponse() {
        List<ResponseInputItem> inputs = new ArrayList<>();

        // System 訊息
        inputs.add(ResponseInputItem.ofMessage(
                ResponseInputItem.Message.builder()
                        .role(ResponseInputItem.Message.Role.USER)
                        .addInputTextContent("請依照「Expository_prompt.docx」內容，把討論內容整理成樹狀JSON。")
                        .build()
        ));

        Response response = OpenAIAPIService.createResponse(ChatModel.GPT_5_MINI, inputs, "resp_68c11a076520819884cbc4ad96a95521021de48df06b9f93", List.of("vs_68ad1a2866d881919db13a36d3a23584"));
//        System.out.println(response.id());
        System.out.println(OpenAIUtils.getOutputText(response));
        System.out.println(OpenAIUtils.extractJsonArray(OpenAIUtils.getOutputText(response)));
    }

    //@Test
    void createChat() {
        OpenAIAPIService.creatChat().choices().stream()
                .flatMap(choice -> choice.message().content().stream())
                .forEach(System.out::println);

    }

//    @Test
    void AudioTranscriptions() {
        File file = new File("/Users/devices.rd/Documents/Docker/LLMWriting/recordings/recorded.webm");
        System.out.println(OpenAIAPIService.AudioTranscriptions(file, AudioModel.GPT_4O_MINI_TRANSCRIBE).text());

    }

}
