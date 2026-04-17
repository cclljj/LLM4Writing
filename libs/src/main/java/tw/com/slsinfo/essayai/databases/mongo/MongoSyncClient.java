package tw.com.slsinfo.essayai.databases.mongo;

import com.mongodb.client.MongoClient;
import org.apache.wicket.Application;

import javax.naming.Context;
import javax.naming.InitialContext;
import javax.naming.NamingException;

/**
 * 預設MongoClient
 */
public enum MongoSyncClient {

    INSTANCE;

    private MongoClient mongoClient;

    /**
     * 使用SPI進行初始化
     */
    private void init() {
        try {
            Context ctx = new InitialContext();
            mongoClient = (MongoClient) ctx.lookup("java:global/MyMongoClient");
        } catch (NamingException e) {
            System.err.println("找不到MongoDB JNDI");
        }

    }

    /**
     * 取得連線，若為首次初始化，則呼叫#init()
     * <p>
     * {@link #init()}
     *
     * @return
     */
    public MongoClient getMongoClient() {
        if (mongoClient == null) {
            init();
        }
        return mongoClient;
    }


    /**
     * 關閉連線，但建議在Application#destroy時做，避免發生例外
     * {@link Application#onDestroy()}
     */
    public void close(Application application) {
        if (application != null && mongoClient != null) {
            mongoClient.close();
        }
    }

}
