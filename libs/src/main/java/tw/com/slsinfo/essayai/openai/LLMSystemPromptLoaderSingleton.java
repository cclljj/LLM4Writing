package tw.com.slsinfo.essayai.openai;


import tw.com.slsinfo.essayai.utils.AIConstants;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Singleton class for llm system prompt loader
 */
public enum LLMSystemPromptLoaderSingleton {
    INSTANCE;
    private String systemPrompt;

    private void init(String type) {
        Path path = null;
        if (type.equals(AIConstants.RemoteLLM4ClassFolder)) {
            path = Paths.get(AIConstants.PATH_TO_LLM4CLASS_SYSTEM_PROMPT_PATH);
        } else if (type.equals(AIConstants.RemoteLLM4WritingFolder)) {
            path = Paths.get(AIConstants.PATH_TO_LLM4WRITING_SYSTEM_PROMPT_PATH);
        }

        LLMSystemPromptManager llmSystemPromptManager = new LLMSystemPromptManager(path);
        systemPrompt = llmSystemPromptManager.getSystemPrompt().orElse("");

    }

    /**
     * Get System Prompt from file
     *
     * @param type llm4writing or llm4class
     * @return
     */
    public String getSystemPrompt(String type) {
        if (systemPrompt == null) {
            init(type);
        }
        return systemPrompt;
    }
}
