package tw.com.slsinfo.localdbutil;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;
import tw.com.slsinfo.commons.io.IOConstants;
import tw.com.slsinfo.commons.io.IOUtils;
import tw.com.slsinfo.commons.io.persistence.LocalPUModel;
import tw.com.slsinfo.commons.io.persistence.LocalPUPropertiesManager;

import java.io.File;
import java.util.Optional;

public enum LocalMySQLEntityManagerSingleton {
    INSTANCE;
    private EntityManager entityManager;

    private void init() {
        final String path = IOConstants.UserHomeFolder_Persistence.concat(File.separator).concat("essayai")
                .concat(File.separator).concat("pu.properties");
        LocalPUPropertiesManager localPUPropertiesManager
                = new LocalPUPropertiesManager(
                new File(path)
        );
        Optional<LocalPUModel>
                localPUModelOptional = localPUPropertiesManager.getObjectModel();
        localPUModelOptional.ifPresentOrElse(
                localPUModel -> {
                    EntityManagerFactory emf = Persistence.createEntityManagerFactory("ailocal",
                            IOUtils.parsePUModel(localPUModel));
                    entityManager = emf.createEntityManager();

                },
                () -> {
                    throw new RuntimeException("No local pu properties found");
                }
        );
    }

    public EntityManager getEntityManager() {
        if (entityManager == null) {
            init();
        }
        return entityManager;
    }
}
