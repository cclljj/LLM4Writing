package tw.com.slsinfo.crypto;

import org.junit.jupiter.api.Test;
import tw.com.slsinfo.commons.crypto.cipher.CryptUtils;
import tw.com.slsinfo.commons.crypto.cipher.decrypt.IDecrypt;
import tw.com.slsinfo.commons.crypto.cipher.encrypt.IEncrypt;
import tw.com.slsinfo.essayai.openai.LLM4ClassTokenLoaderSingleton;
import tw.com.slsinfo.essayai.openai.LLM4WritingTokenLoaderSingleton;

import java.security.Key;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 測試加解密TOKEN
 */
class CryptoSecrets {
    /**
     * 注意，如果產生過JKS，請勿再重複產生
     */
    //@Test
    void doTokenEncrypt() {
        String token = LLM4WritingTokenLoaderSingleton.INSTANCE.getLocalToken();
        System.out.println(token);
        //產生加解密金鑰
        String project = "essayai";
        //只能產生一次
        //CryptUtils.initSecretKeyStore(true, project);
        Optional<Key> keyOptional = CryptUtils.getSecretKeyFromKeyStore(true, project);

        keyOptional.ifPresent(key -> {
            IEncrypt encrypt = new CryptUtils.SLSEncrypt();
            Optional<String> enc = encrypt.doEncrypt(token, key);
            enc.ifPresent(text -> {
                System.out.println(text);
                IDecrypt dec = new CryptUtils.SLSDecrypt();
                Optional<String> decoded = dec.decrypt(text, key);
                decoded.ifPresent(txt -> {
                    System.out.println(txt);
                    assertEquals(txt, token);
                });
            });
        });
    }

//    @Test
    void doTokenService() {
        String token = LLM4WritingTokenLoaderSingleton.INSTANCE.getLocalToken();
        System.out.println(token);
        token = LLM4ClassTokenLoaderSingleton.INSTANCE.getLocalToken();
        System.out.println(token);
    }
}
