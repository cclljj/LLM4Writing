package tw.com.slsinfo.essayai.openai;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.annotation.Nonnull;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;


/**
 * LLM System Prompt from txt file
 */
public class LLMSystemPromptManager {
    private static final Logger logger = LoggerFactory.getLogger(LLMSystemPromptManager.class);
    private String systemPrompt;

    public LLMSystemPromptManager(@Nonnull Path systemPromptFile) {
        try {
            systemPrompt = Files.readString(systemPromptFile);
        } catch (IOException e) {
            logger.debug("read system prompt file error", e);
            systemPrompt = "哈囉，你是一個專門協助臺灣12歲至18歲學童撰寫作文以及進行討論的助手。請協助學童們進行學習。";
        }
    }

    /**
     * Get System Default Prompt
     *
     * @return
     */
    public Optional<String> getSystemPrompt() {
        return Optional.ofNullable(systemPrompt);
    }


}
