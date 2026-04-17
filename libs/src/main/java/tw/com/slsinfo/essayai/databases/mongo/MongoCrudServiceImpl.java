package tw.com.slsinfo.essayai.databases.mongo;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.UpdateOptions;
import com.mongodb.client.result.DeleteResult;
import com.mongodb.client.result.InsertManyResult;
import com.mongodb.client.result.InsertOneResult;
import com.mongodb.client.result.UpdateResult;
import jakarta.ejb.Local;
import jakarta.ejb.Stateless;
import org.bson.codecs.configuration.CodecProvider;
import org.bson.codecs.configuration.CodecRegistry;
import org.bson.codecs.pojo.PojoCodecProvider;
import org.bson.conversions.Bson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.database.generic.IMongoCrudService;

import java.util.List;

import static com.mongodb.MongoClientSettings.getDefaultCodecRegistry;
import static org.bson.codecs.configuration.CodecRegistries.fromProviders;
import static org.bson.codecs.configuration.CodecRegistries.fromRegistries;


@Stateless
@Local(IMongoCrudService.class)
public class MongoCrudServiceImpl<T> implements IMongoCrudService<T> {

    private static final Logger logger = LoggerFactory.getLogger(MongoCrudServiceImpl.class);
    private static final String DB_NAME = "ailog";
    private MongoDatabase mongoDatabase;
    private MongoCollection<T> collection;

    public MongoCrudServiceImpl() {
        init();
    }

    /**
     * 使用 POJO 進行轉換
     */
    private void init() {
        CodecProvider pojoCodecProvider = PojoCodecProvider.builder().automatic(true).build();
        CodecRegistry pojoCodecRegistry = fromRegistries(getDefaultCodecRegistry(), fromProviders(pojoCodecProvider));
        mongoDatabase = MongoSyncClient.INSTANCE.getMongoClient().getDatabase(DB_NAME).withCodecRegistry(pojoCodecRegistry);
    }


    @Override
    public InsertOneResult insertOne(Class<T> type, T entity) {
        String COLLECTION_NAME = type.getSimpleName().toLowerCase();
        collection = mongoDatabase.getCollection(COLLECTION_NAME, type);
        return collection.insertOne(entity);
    }

    @Override
    public InsertManyResult insertMany(Class<T> type, List<T> entity) {
        String COLLECTION_NAME = type.getSimpleName().toLowerCase();
        collection = mongoDatabase.getCollection(COLLECTION_NAME, type);
        return collection.insertMany(entity);
    }

    @Override
    public FindIterable<T> find(Class<T> type, Bson bson) {
        String COLLECTION_NAME = type.getSimpleName().toLowerCase();
        collection = mongoDatabase.getCollection(COLLECTION_NAME, type);
        return collection.find(bson);
    }


    @Override
    public FindIterable<T> find(Class<T> type) {
        String COLLECTION_NAME = type.getSimpleName().toLowerCase();
        collection = mongoDatabase.getCollection(COLLECTION_NAME, type);
        return collection.find();
    }

    @Override
    public UpdateResult updateOne(Class<T> type, Bson filter, Bson updateOperation, UpdateOptions options) {
        String COLLECTION_NAME = type.getSimpleName().toLowerCase();
        collection = mongoDatabase.getCollection(COLLECTION_NAME, type);
        return collection.updateOne(filter, updateOperation, options);
    }

    @Override
    public UpdateResult updateOne(Class<T> type, Bson filter, Bson updateOperation) {
        String COLLECTION_NAME = type.getSimpleName().toLowerCase();
        collection = mongoDatabase.getCollection(COLLECTION_NAME, type);
        return collection.updateOne(filter, updateOperation);
    }

    @Override
    public UpdateResult updateMany(Class<T> type, Bson filter, Bson updateOperation) {
        String COLLECTION_NAME = type.getSimpleName().toLowerCase();
        collection = mongoDatabase.getCollection(COLLECTION_NAME, type);
        return collection.updateMany(filter, updateOperation);
    }


    @Override
    public UpdateResult updateMany(Class<T> type, Bson filter, Bson updateOperation, UpdateOptions options) {
        String COLLECTION_NAME = type.getSimpleName().toLowerCase();
        collection = mongoDatabase.getCollection(COLLECTION_NAME, type);
        return collection.updateMany(filter, updateOperation, options);
    }

    @Override
    public DeleteResult delete(Class<T> type, Bson filter) {
        String COLLECTION_NAME = type.getSimpleName().toLowerCase();
        collection = mongoDatabase.getCollection(COLLECTION_NAME, type);
        return collection.deleteMany(filter);
    }

}
