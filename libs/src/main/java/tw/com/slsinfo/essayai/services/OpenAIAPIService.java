package tw.com.slsinfo.essayai.services;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;

import com.openai.core.JsonValue;
import com.openai.core.http.StreamResponse;
import com.openai.models.ChatModel;
import com.openai.models.audio.AudioModel;
import com.openai.models.audio.transcriptions.Transcription;
import com.openai.models.audio.transcriptions.TranscriptionCreateParams;
import com.openai.models.chat.completions.ChatCompletion;
import com.openai.models.chat.completions.ChatCompletionCreateParams;
import com.openai.models.files.FileDeleted;
import com.openai.models.files.FilePurpose;
import com.openai.models.responses.*;

import com.openai.models.files.FileObject;

import com.openai.models.responses.Response;
import com.openai.models.vectorstores.VectorStore;
import com.openai.models.vectorstores.VectorStoreCreateParams;
import com.openai.models.vectorstores.files.FileCreateParams;
import com.openai.models.vectorstores.files.VectorStoreFile;
import org.apache.commons.lang3.ObjectUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.essayai.openai.LLM4ClassTokenLoaderSingleton;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.apache.hc.client5.http.async.methods.SimpleHttpRequest;
import org.apache.hc.client5.http.async.methods.SimpleHttpResponse;
import org.apache.hc.client5.http.impl.async.CloseableHttpAsyncClient;
import org.apache.hc.client5.http.impl.async.HttpAsyncClients;
import org.apache.hc.core5.http.ContentType;
import org.apache.http.HttpHeaders;
import tw.com.slsinfo.essayai.models.openai.*;

import java.util.concurrent.TimeUnit;

import java.io.IOException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;

/**
 * 自主開發，要改用openai-java-sdk
 */
@Deprecated
public class OpenAIAPIService {
    private final Logger logger = LoggerFactory.getLogger(OpenAIAPIService.class);

    private static final String apiKey = LLM4ClassTokenLoaderSingleton.INSTANCE.getLocalToken();
    private static final OpenAIClient CLIENT = OpenAIOkHttpClient.builder()
            .apiKey(apiKey) // 指定 API Key
            .build();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /**
     * 呼叫 responses
     * @param model
     * @return
     */
    public static ChatResponseModel postResponse(ChatRequestModel model) {

        try (CloseableHttpAsyncClient httpAsyncClient = HttpAsyncClients.createDefault()) {

            httpAsyncClient.start();
            final SimpleHttpRequest simpleHttpRequest
                    = new SimpleHttpRequest("POST", "https://api.openai.com/v1/responses");
            simpleHttpRequest.setHeader(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON);
            simpleHttpRequest.setHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey);

            JsonFactory jsonFactory = new JsonFactory();
            ObjectMapper objectMapper = new ObjectMapper(jsonFactory)
                    .setSerializationInclusion(JsonInclude.Include.NON_NULL)
                    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

            simpleHttpRequest.setBody(objectMapper.writeValueAsString(model), ContentType.APPLICATION_JSON);

            System.out.println(simpleHttpRequest.getBodyText());

            Future<SimpleHttpResponse> future = httpAsyncClient.execute(simpleHttpRequest, null);
            SimpleHttpResponse response = future.get();
            int httpCode = response.getCode();

            System.out.println("Response Http Code :" + httpCode);

            String json = response.getBodyText();

            System.out.println("API Response :\n" + json);

            return objectMapper.readValue(json, ChatResponseModel.class);

        } catch (IOException | InterruptedException | ExecutionException e) {
            System.out.println(e.getMessage());
            return null;
        }
    }

    /**
     * set File to vector store
     * @param vid vector store ID
     * @param fid File ID
     */
    public static VectorResponseModel postVectorFile(String vid, String fid) {
        try (CloseableHttpAsyncClient httpAsyncClient = HttpAsyncClients.createDefault()) {

            httpAsyncClient.start();

            String path = "https://api.openai.com/v1/vector_stores/".concat(vid).concat("/files");
            final SimpleHttpRequest simpleHttpRequest
                    = new SimpleHttpRequest("POST", path);
            simpleHttpRequest.setHeader(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON);
            simpleHttpRequest.setHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey);

            JsonFactory jsonFactory = new JsonFactory();
            ObjectMapper objectMapper = new ObjectMapper(jsonFactory)
                    .setSerializationInclusion(JsonInclude.Include.NON_NULL)
                    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);


            simpleHttpRequest.setBody(objectMapper.writeValueAsString(new SetFileModel(fid)), ContentType.APPLICATION_JSON);

            System.out.println(simpleHttpRequest.getBodyText());

            Future<SimpleHttpResponse> future = httpAsyncClient.execute(simpleHttpRequest, null);
            SimpleHttpResponse response = future.get();
            int httpCode = response.getCode();

            System.out.println("Response Http Code :" + httpCode);

            String json = response.getBodyText();

            System.out.println("API Response :\n" + json);

            return objectMapper.readValue(json, VectorResponseModel.class);

        } catch (IOException | InterruptedException | ExecutionException e) {
            System.out.println(e.getMessage());
            return null;
        }
    }

    /**
     * 建立vector store
     */
    public static VectorResponseModel postVector(VectorRequestModel model) {
        try (CloseableHttpAsyncClient httpAsyncClient = HttpAsyncClients.createDefault()) {

            httpAsyncClient.start();
            final SimpleHttpRequest simpleHttpRequest
                    = new SimpleHttpRequest("POST", "https://api.openai.com/v1/vector_stores");
            simpleHttpRequest.setHeader(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON);
            simpleHttpRequest.setHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey);

            JsonFactory jsonFactory = new JsonFactory();
            ObjectMapper objectMapper = new ObjectMapper(jsonFactory)
                    .setSerializationInclusion(JsonInclude.Include.NON_NULL)
                    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

            simpleHttpRequest.setBody(objectMapper.writeValueAsString(model), ContentType.APPLICATION_JSON);

            System.out.println(simpleHttpRequest.getBodyText());

            Future<SimpleHttpResponse> future = httpAsyncClient.execute(simpleHttpRequest, null);
            SimpleHttpResponse response = future.get();
            int httpCode = response.getCode();

            System.out.println("Response Http Code :" + httpCode);

            String json = response.getBodyText();

            System.out.println("API Response :\n" + json);

            return objectMapper.readValue(json, VectorResponseModel.class);

        } catch (IOException | InterruptedException | ExecutionException e) {
            System.out.println(e.getMessage());
            return null;
        }
    }

    /**
     * upload file
     */
    public static FileResponseModel postFile(FileRequestModel fileRQModel) {
        try {
            // 檢查輸入
            if (fileRQModel == null || fileRQModel.getFile() == null) {
                System.out.println("fileRQModel 或 file 為空");
                return null;
            }
            File file = fileRQModel.getFile();
            if (!file.exists() || !file.isFile() || file.length() == 0) {
                System.out.println("檔案不存在或為空：" + file.getAbsolutePath());
                return null;
            }

            String purpose = (fileRQModel.getPurpose() == null || fileRQModel.getPurpose().isBlank())
                    ? "assistants" : fileRQModel.getPurpose();

            // OKHttp 是為了處理上傳檔案檔名為中文的問題，若使用simpleHttpRequest檔名會變成?????
            // OkHttp client（簡單超時）
            OkHttpClient client = new OkHttpClient.Builder()
                    .connectTimeout(10, TimeUnit.SECONDS)
                    .readTimeout(120, TimeUnit.SECONDS)
                    .writeTimeout(120, TimeUnit.SECONDS)
                    .build();

            // multipart/form-data
            MediaType octet = MediaType.parse("application/octet-stream");
            RequestBody fileBody = RequestBody.create(file, octet);

            MultipartBody body = new MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    // 第二個參數為檔名；OkHttp 會正確處理非 ASCII（通常不需要額外設定）
                    .addFormDataPart("file", file.getName(), fileBody)
                    .addFormDataPart("purpose", purpose)
                    .build();

            Request request = new Request.Builder()
                    .url("https://api.openai.com/v1/files")
                    .addHeader("Authorization", "Bearer " + apiKey)
                    .addHeader("Accept", "application/json")
                    .post(body)
                    .build();

            ObjectMapper om = new ObjectMapper()
                    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
                    .setSerializationInclusion(JsonInclude.Include.NON_NULL);

            try (okhttp3.Response resp = client.newCall(request).execute()) {
                int code = resp.code();
                String respBody = resp.body() != null ? resp.body().string() : "";
                System.out.println("HTTP " + code);
                // System.out.println("Body:\n" + respBody);

                if (resp.isSuccessful()) {
                    return om.readValue(respBody, FileResponseModel.class);
                } else {
                    System.out.println("Upload failed body: " + respBody);
                    return null;
                }
            }
        } catch (Exception e) {
            System.out.println("上傳失敗：" + e.getMessage());
            return null;
        }
    }

    /**
     * Responses：建立回應
     * @param model chatModel ex:GPT_5
     * @param inputs prompt request
     * @param vectorStoreIds Vector Store ID (可以同時綁定多個)
     * @return Response
     */
    public static Response createResponse(ChatModel model, List<ResponseInputItem> inputs, String previousResponseId, List<String> vectorStoreIds) {
        // create 一次性回傳
        ResponseCreateParams.Builder builder = ResponseCreateParams.builder()
                .model(model)
                .input(ResponseCreateParams.Input.ofResponse(inputs));

        // 傳入前次對話ID
        if (StringUtils.isNotBlank(previousResponseId)) {
            builder.previousResponseId(previousResponseId);
        }

        // 綁定Vector Store
        if (ObjectUtils.isNotEmpty(vectorStoreIds)) {
            builder.addFileSearchTool(vectorStoreIds);
        }

        return CLIENT.responses().create(builder.build());
    }

    /**
     * StreamResponse：建立串流回應
     * @param model chatModel ex:GPT_5
     * @param inputs prompt request
     * @param vectorStoreIds Vector Store ID (可以同時綁定多個)
     * @return Response
     */
    public static StreamResponse<ResponseStreamEvent> createStreamResponse(ChatModel model, List<ResponseInputItem> inputs, String previousResponseId, List<String> vectorStoreIds) {
        // createStreaming 串流回傳
        ResponseCreateParams.Builder builder = ResponseCreateParams.builder()
                .model(model)
                .input(ResponseCreateParams.Input.ofResponse(inputs));

        // 傳入前次對話ID
        if (StringUtils.isNotBlank(previousResponseId)) {
            builder.previousResponseId(previousResponseId);
        }

        // 綁定Vector Store
        if (ObjectUtils.isNotEmpty(vectorStoreIds)) {
            builder.addFileSearchTool(vectorStoreIds);
        }

        return CLIENT.responses().createStreaming(builder.build());
    }

    /**
     * Chat CompletionCreate
     */
    public static ChatCompletion creatChat() {
        ChatCompletionCreateParams.Metadata metadata = ChatCompletionCreateParams.Metadata.builder()
                .putAdditionalProperty("speaker", JsonValue.from("Alice"))
                .build();

        ChatCompletionCreateParams createParams = ChatCompletionCreateParams.builder()
                .model(ChatModel.GPT_4O_MINI)
                .store(true)
                .metadata(metadata)
//                .addDeveloperMessage("你是一位作文老師。")
                .addUserMessage("speaker是誰？")
                .build();

        return CLIENT.chat().completions().create(createParams);
    }

    /**
     * Files：上傳檔案
     * @param file
     * @param purpose
     * @return
     */
    public static FileObject uploadFile(File file, FilePurpose purpose) {

        Objects.requireNonNull(file, "file is null");
        if (!file.exists() || !file.isFile() || file.length() == 0) {
            throw new IllegalArgumentException("file not found or empty: " + file);
        }

        com.openai.models.files.FileCreateParams params = com.openai.models.files.FileCreateParams.builder()
                .file(Paths.get(file.toURI()))
                .purpose(purpose)
                .build();

        return CLIENT.files().create(params);
    }

    /**
     * Vector Store：建立向量庫
     * @param name
     * @return
     */
    public static VectorStore createVectorStore(String name) {
        VectorStoreCreateParams params = VectorStoreCreateParams.builder()
                .name(name)
                .build();
        return CLIENT.vectorStores().create(params);
    }

    /**
     * Vector Store：把檔案掛進向量庫
     * @param vectorStoreId
     * @param fileId
     * @return
     */
    public static VectorStoreFile addFileToVectorStore(String vectorStoreId, String fileId) {
        FileCreateParams params = FileCreateParams.builder()
                .vectorStoreId(vectorStoreId)
                .fileId(fileId)
                .build();

        // 同步（blocking）呼叫
        return CLIENT.vectorStores().files().create(vectorStoreId, params);
    }

    /**
     * 刪除檔案
     * @param fileId
     * @return
     */
    public static FileDeleted deleteFile(String fileId) {
        return CLIENT.files().delete(fileId);
    }

    /**
     * 語音轉文字
     */
    public static Transcription AudioTranscriptions(File file, AudioModel audioModel) {
        if (!file.exists() || !file.isFile() || file.length() == 0) {
            throw new IllegalArgumentException("file not found or empty: " + file);
        }

        TranscriptionCreateParams createParams = TranscriptionCreateParams.builder()
                .file(file.toPath())
                .model(audioModel)
                .build();

        return CLIENT.audio().transcriptions().create(createParams).asTranscription();
    }

}
