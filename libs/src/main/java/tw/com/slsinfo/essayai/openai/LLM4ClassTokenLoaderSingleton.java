package tw.com.slsinfo.essayai.openai;

import tw.com.slsinfo.commons.crypto.cipher.CryptUtils;
import tw.com.slsinfo.commons.crypto.cipher.decrypt.IDecrypt;
import tw.com.slsinfo.commons.crypto.cipher.encrypt.IEncrypt;
import tw.com.slsinfo.commons.io.IOConstants;
import tw.com.slsinfo.essayai.utils.AIConstants;

import java.io.File;
import java.security.Key;
import java.util.Optional;

/**
 * Singleton class for llm4class token loader
 */
public enum LLM4ClassTokenLoaderSingleton {
    INSTANCE;
    private String localtoken, token;

    private void init(boolean isLocal) {
        if (isLocal) {
            final String path = IOConstants.UserHomeFolder_Secret.concat(File.separator).concat("essayai")
                    .concat(File.separator).concat("openai_llm4class.properties");

            OpenAITokenManager openAITokenManager
                    = new OpenAITokenManager(
                    new File(path)
            );
            Optional<String>
                    tokenOptional = openAITokenManager.getObjectModel();
            tokenOptional.ifPresentOrElse(
                    value -> {
                        Optional<Key> keyOptional = CryptUtils.getSecretKeyFromKeyStore(true, AIConstants.PROJECT_LLM4WRITING);
                        System.out.println(keyOptional.get());

                        keyOptional.ifPresent(key -> {
                            IDecrypt dec = new CryptUtils.SLSDecrypt();
                            Optional<String> decoded = dec.decrypt(value, key);
                            decoded.ifPresent(txt -> {
                                localtoken = txt;

                            });
                        });
                    },
                    () -> {
                        throw new RuntimeException("No local openai properties found");
                    }
            );
        } else {
            final String path = IOConstants.RemoteHostFolder_Secret.concat(File.separator).concat("openai_llm4class.properties");
            OpenAITokenManager openAITokenManager
                    = new OpenAITokenManager(
                    new File(path)
            );
            Optional<String>
                    tokenOptional = openAITokenManager.getObjectModel();
            tokenOptional.ifPresentOrElse(
                    value -> {
                        Optional<Key> keyOptional = CryptUtils.getSecretKeyFromKeyStore(false, AIConstants.PROJECT_LLM4WRITING);

                        keyOptional.ifPresent(key -> {
                            IDecrypt dec = new CryptUtils.SLSDecrypt();
                            Optional<String> decoded = dec.decrypt(value, key);
                            decoded.ifPresent(txt -> {
                                token = txt;

                            });
                        });
                    },
                    () -> {
                        throw new RuntimeException("No local openai properties found");
                    }
            );
        }

    }

    /**
     * 本機Token
     *
     * @return
     */
    public String getLocalToken() {
        if (localtoken == null) {
            init(true);
        }
        return localtoken;
    }

    /**
     * 主機Token
     *
     * @return
     */
    public String getToken() {
        if (token == null) {
            init(false);
        }
        return token;
    }


}
