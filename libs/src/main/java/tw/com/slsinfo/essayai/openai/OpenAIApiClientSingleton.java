package tw.com.slsinfo.essayai.openai;

import com.openai.client.OpenAIClient;
import com.openai.client.OpenAIClientAsync;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import com.openai.client.okhttp.OpenAIOkHttpClientAsync;
import tw.com.slsinfo.essayai.utils.AIConstants;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.concurrent.ExecutorService;

/**
 * Singleton class for one instance of OpenAIClient
 */
public enum OpenAIApiClientSingleton {
    INSTANCE;
    private OpenAIClientAsync openAIClientAsync;
    private OpenAIClient openAIClient;

    private void init(String type, ExecutorService executorService, Duration timeout) {
        String apiKey = "";
        if (type.equals(AIConstants.RemoteLLM4ClassFolder)) {
            apiKey = LLM4ClassTokenLoaderSingleton.INSTANCE.getToken();
        } else if (type.equals(AIConstants.RemoteLLM4WritingFolder)) {
            apiKey = LLM4WritingTokenLoaderSingleton.INSTANCE.getToken();
        }
        openAIClient = OpenAIOkHttpClient.builder().fromEnv().apiKey(apiKey).maxRetries(3).timeout(timeout).streamHandlerExecutor(executorService).build();
        openAIClientAsync = OpenAIOkHttpClientAsync.builder().fromEnv().maxRetries(3).timeout(timeout).apiKey(apiKey).streamHandlerExecutor(executorService).build();

    }


    public OpenAIClient getOpenAIClient(String type, ExecutorService executorService, Duration timeout) {
        if (openAIClient == null) {
            init(type, executorService, timeout);
        }
        return openAIClient;
    }

    public OpenAIClientAsync getOpenAIClientAsync(String type, ExecutorService executorService, Duration timeout) {
        if (openAIClientAsync == null) {
            init(type, executorService, timeout);
        }
        return openAIClientAsync;
    }
}
