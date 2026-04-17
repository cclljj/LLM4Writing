package tw.com.slsinfo.essayai.openai;

import org.apache.commons.configuration2.Configuration;
import org.apache.commons.configuration2.FileBasedConfiguration;
import org.apache.commons.configuration2.PropertiesConfiguration;
import org.apache.commons.configuration2.builder.ReloadingFileBasedConfigurationBuilder;
import org.apache.commons.configuration2.ex.ConfigurationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tw.com.slsinfo.commons.io.IOConstants;
import tw.com.slsinfo.commons.io.properties.AbstractPropertiesManager;
import tw.com.slsinfo.essayai.utils.AIConstants;

import javax.annotation.Nonnull;
import java.io.File;
import java.util.Optional;


/**
 * 用來讀取OpenAU設定檔類別
 */
public class OpenAITokenManager extends AbstractPropertiesManager<String> {
    private static final Logger logger = LoggerFactory.getLogger(OpenAITokenManager.class);

    public OpenAITokenManager(boolean isPowerUser, @Nonnull File configfile) {
        super(isPowerUser, configfile);
    }

    public OpenAITokenManager(@Nonnull File configfile) {
        super(configfile);
    }

    @Override
    protected Optional<String> makeModelObject() {
        Optional<String> token = Optional.empty();
        if (!properties.isEmpty()) {
//            logger.debug("Properties parsed from config file");
//            if (logger.isDebugEnabled()) {
            properties.forEach((k, v) -> {
//                logger.debug("Key: {}, Value: {}", k, v);
            });
//            }
            token = Optional.ofNullable(properties.get(AIConstants.OPENAI_TOKEN));
        }
        return token;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public void parseProperties() {
        properties.put(AIConstants.OPENAI_TOKEN, config.getString(AIConstants.OPENAI_TOKEN, ""));
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public Optional<Configuration> getConfiguration() {
        Optional<Configuration> configurationOptional = Optional.empty();
        ReloadingFileBasedConfigurationBuilder<FileBasedConfiguration> builder =
                new ReloadingFileBasedConfigurationBuilder<FileBasedConfiguration>(PropertiesConfiguration.class)
                        .configure(IOConstants.loadFileParameters(getConfigfile()));
        try {
            configurationOptional = Optional.ofNullable(builder.getConfiguration());
        } catch (ConfigurationException e) {
            logger.debug("Error parsing configuration", e);
        }

        return configurationOptional;
    }
}
