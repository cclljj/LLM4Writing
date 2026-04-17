package tw.com.slsinfo.essayai.services;

import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import tw.com.slsinfo.commons.crypto.cipher.CryptUtils;
import tw.com.slsinfo.commons.crypto.cipher.decrypt.IDecrypt;
import tw.com.slsinfo.commons.crypto.cipher.encrypt.IEncrypt;

import java.security.Key;
import java.util.Optional;

/**
 * Crypto encryption and decryption service
 */
@ApplicationScoped
public class CryptoService {

    private Optional<Key> key;

    private IDecrypt iDecrypt;

    private IEncrypt iEncrypt;


    @PostConstruct
    public void init() {
        key = CryptUtils.getReleaseSecretKeyFromKeyStore();
        iDecrypt = new CryptUtils.SLSDecrypt();
        iEncrypt = new CryptUtils.SLSEncrypt();
    }


    public Optional<Key> getKey() {
        return key;
    }

    public IDecrypt getiDecrypt() {
        return iDecrypt;
    }

    public IEncrypt getiEncrypt() {
        return iEncrypt;
    }
}
