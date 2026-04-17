package tw.com.slsinfo.essayai.services;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import okhttp3.*;
import org.apache.hc.client5.http.async.methods.SimpleHttpRequest;
import org.apache.hc.client5.http.async.methods.SimpleHttpResponse;
import org.apache.hc.client5.http.impl.async.CloseableHttpAsyncClient;
import org.apache.hc.client5.http.impl.async.HttpAsyncClients;
import org.apache.hc.core5.http.ContentType;
import org.apache.http.HttpHeaders;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tw.com.slsinfo.essayai.models.openai.*;
import tw.com.slsinfo.essayai.openai.LLM4WritingTokenLoaderSingleton;
import tw.com.slsinfo.essayai.utils.AIConstants;

import java.io.File;
import java.io.IOException;
import java.util.Collections;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * 土炮方式呼叫，不建議使用
 */
@Deprecated(since = "20250823", forRemoval = true)
@ApplicationScoped
public class OpenAIApiWebService {
    private final Logger logger = LogManager.getLogger(OpenAIApiWebService.class);
    private String apiKey;

    @PostConstruct
    public void init() {
        apiKey = LLM4WritingTokenLoaderSingleton.INSTANCE.getToken();
    }


    /**
     * GPT對話前先設定System Prompt
     *
     * @param systemPrompt
     * @return
     */
    public Optional<ChatResponseModel> postSystemPrompt(String systemPrompt) {
        ChatRequestModel chatRequest = new ChatRequestModel();
        chatRequest.setModel(AIConstants.OPENAI_MODEL_GPT_5_MINI);
        ReasoningModel reasoningModel = new ReasoningModel();
        reasoningModel.setEffort(AIConstants.OPENAI_REASONING_EFFORT_MEDIUM);

        OpenAIInputModel openAIInputModel = new OpenAIInputModel();
        openAIInputModel.setRole(AIConstants.OPENAI_ROLE_SYSTEM);
        openAIInputModel.setContent(systemPrompt);

        chatRequest.setReasoning(reasoningModel);
        chatRequest.setInput(Collections.singletonList(openAIInputModel));
        return postResponse(chatRequest);
    }

    /**
     * 呼叫 responses
     *
     * @param model
     * @return
     */
    public Optional<ChatResponseModel> postResponse(ChatRequestModel model) {

        try (CloseableHttpAsyncClient httpAsyncClient = HttpAsyncClients.createDefault()) {

            httpAsyncClient.start();
            final SimpleHttpRequest simpleHttpRequest
                    = new SimpleHttpRequest("POST", AIConstants.OPENAI_API_RESPONSE_URL);
            simpleHttpRequest.setHeader(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON);
            simpleHttpRequest.setHeader(HttpHeaders.AUTHORIZATION, AIConstants.REQUEST_BEARER_HEADER.concat(apiKey));

            ObjectMapper objectMapper = new ObjectMapper()
                    .setSerializationInclusion(JsonInclude.Include.NON_NULL)
                    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

            simpleHttpRequest.setBody(objectMapper.writeValueAsString(model), ContentType.APPLICATION_JSON);

            Future<SimpleHttpResponse> future = httpAsyncClient.execute(simpleHttpRequest, null);
            SimpleHttpResponse response = future.get();
            int httpCode = response.getCode();
            String json = response.getBodyText();
//            logger.debug("OpenAI Request API : Response code: {}, Response Body:{}", httpCode, json);
            return Optional.ofNullable(objectMapper.readValue(json, ChatResponseModel.class));

        } catch (IOException | InterruptedException | ExecutionException e) {
            logger.debug(e.getMessage(), e);
            return Optional.empty();
        }
    }

    /**
     * Send File to vector store
     *
     * @param vector vector store ID
     * @param file   File ID
     */
    public Optional<VectorResponseModel> mappingVectorFile(String vector, String file) {
        try (CloseableHttpAsyncClient httpAsyncClient = HttpAsyncClients.createDefault()) {

            httpAsyncClient.start();

            String path = AIConstants.OPENAI_API_VECTOR_FILE_MAPPING_URL.concat(vector).concat(AIConstants.OPENAI_API_VECRTOR_FILE_FILES_POSTFIX);
            final SimpleHttpRequest simpleHttpRequest
                    = new SimpleHttpRequest("POST", path);
            simpleHttpRequest.setHeader(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON);
            simpleHttpRequest.setHeader(HttpHeaders.AUTHORIZATION, AIConstants.REQUEST_BEARER_HEADER.concat(apiKey));


            ObjectMapper objectMapper = new ObjectMapper()
                    .setSerializationInclusion(JsonInclude.Include.NON_NULL)
                    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);


            simpleHttpRequest.setBody(objectMapper.writeValueAsString(new SetFileModel(file)), ContentType.APPLICATION_JSON);

            System.out.println(simpleHttpRequest.getBodyText());

            Future<SimpleHttpResponse> future = httpAsyncClient.execute(simpleHttpRequest, null);
            SimpleHttpResponse response = future.get();
            int httpCode = response.getCode();
            String json = response.getBodyText();
//            logger.debug("OpenAI VectorFile API : Response code: {}, Response Body:{}", httpCode, json);
            return Optional.ofNullable(objectMapper.readValue(json, VectorResponseModel.class));

        } catch (IOException | InterruptedException | ExecutionException e) {
            logger.debug(e.getMessage(), e);
            return Optional.empty();
        }
    }

    /**
     * 建立vector store
     */
    public Optional<VectorResponseModel> createVectorStore(VectorResponseModel model) {
        try (CloseableHttpAsyncClient httpAsyncClient = HttpAsyncClients.createDefault()) {

            httpAsyncClient.start();
            final SimpleHttpRequest simpleHttpRequest
                    = new SimpleHttpRequest("POST", AIConstants.OPENAI_API_VECTOR_URL);
            simpleHttpRequest.setHeader(HttpHeaders.CONTENT_TYPE, ContentType.APPLICATION_JSON);
            simpleHttpRequest.setHeader(HttpHeaders.AUTHORIZATION, AIConstants.REQUEST_BEARER_HEADER.concat(apiKey));

            ObjectMapper objectMapper = new ObjectMapper()
                    .setSerializationInclusion(JsonInclude.Include.NON_NULL)
                    .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

            simpleHttpRequest.setBody(objectMapper.writeValueAsString(model), ContentType.APPLICATION_JSON);

            System.out.println(simpleHttpRequest.getBodyText());

            Future<SimpleHttpResponse> future = httpAsyncClient.execute(simpleHttpRequest, null);
            SimpleHttpResponse response = future.get();
            int httpCode = response.getCode();
            String json = response.getBodyText();
//            logger.debug("OpenAI Create Vector API : Response code: {}, Response Body:{}", httpCode, json);
            return Optional.ofNullable(objectMapper.readValue(json, VectorResponseModel.class));

        } catch (IOException | InterruptedException | ExecutionException e) {
            logger.debug(e.getMessage(), e);
            return Optional.empty();
        }
    }

    /**
     * Upload file to OpenAI
     */
    public Optional<FileResponseModel> sendFile(FileRequestModel fileRequestModel) {
        try {
            // 檢查輸入
            if (fileRequestModel == null || fileRequestModel.getFile() == null) {
                logger.warn("fileRequestModel 或 file 為空");
                return Optional.empty();
            }

            File file = fileRequestModel.getFile();
            if (!file.exists() || !file.isFile() || file.length() == 0) {
                logger.warn("檔案不存在或為空：{}", file.getAbsolutePath());
                return Optional.empty();
            }

            String purpose = (fileRequestModel.getPurpose() == null || fileRequestModel.getPurpose().isBlank())
                    ? "assistants" : fileRequestModel.getPurpose();

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

            try (Response resp = client.newCall(request).execute()) {
                int httpCode = resp.code();
                String respBody = resp.body() != null ? resp.body().string() : "";
//                logger.debug("OpenAI Create Vector API : Response code: {}, Response Body:{}", httpCode, respBody);
                if (resp.isSuccessful()) {
                    return Optional.ofNullable(om.readValue(respBody, FileResponseModel.class));
                } else {
                    logger.debug("上傳失敗：{}", respBody);
                    return Optional.empty();
                }
            }
        } catch (Exception e) {
            logger.debug("上傳失敗：{}", e.getMessage());
            return Optional.empty();
        }
    }
}