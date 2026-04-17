package tw.com.slsinfo.essayai.services;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import tw.com.slsinfo.commons.crypto.cipher.CryptUtils;
import tw.com.slsinfo.essayai.openai.LLM4WritingTokenLoaderSingleton;

@ApplicationScoped
public class OpenAITokenService {

    private String OPENAI_TOKEN;

    @PostConstruct
    public void init() {
        OPENAI_TOKEN = LLM4WritingTokenLoaderSingleton.INSTANCE.getToken();
    }

    public String getOpenAiToken() {
        return OPENAI_TOKEN;
    }
}
