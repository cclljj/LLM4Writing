package tw.com.slsinfo.essayai.chatroom;

import org.apache.wicket.protocol.ws.api.registry.IKey;
import org.apache.wicket.protocol.ws.api.registry.IWebSocketConnectionRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class OpenClassIKeyConnectionsFilter implements IWebSocketConnectionRegistry.IConnectionsFilter {

    private static final Logger logger = LoggerFactory.getLogger(OpenClassIKeyConnectionsFilter.class);
    private final Integer ocid;
    private final SameClassMemberIndex sameClassMemberIndex;


    /**
     *
     * @param groupId           小組編號
     * @param chatGroupRegistry 小組登錄資料
     */
    public OpenClassIKeyConnectionsFilter(Integer ocid, SameClassMemberIndex sameClassMemberIndex) {
        this.ocid = ocid;
        this.sameClassMemberIndex = sameClassMemberIndex;
    }

    @Override
    public boolean accept(String sessionId, IKey key) {
        return sameClassMemberIndex.memberOf(ocid, sessionId);
    }

}