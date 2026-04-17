package tw.com.slsinfo.essayai.chatroom;

import org.apache.wicket.protocol.ws.api.registry.IKey;
import org.apache.wicket.protocol.ws.api.registry.IWebSocketConnectionRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;
import java.util.Set;


/**
 * 客制化小組訊息target filter<br>
 * 以grouId戈大弓土主要Filter
 */
public class GroupConnectionsFilter implements IWebSocketConnectionRegistry.IConnectionsFilter {

    private static final Logger logger = LoggerFactory.getLogger(GroupIKeyConnectionsFilter.class);
    private final Integer groupId;
    private final ChatGroupRegistry chatGroupRegistry;


    /**
     *
     * @param groupId           小組編號
     * @param chatGroupRegistry 小組登錄資料
     */
    public GroupConnectionsFilter(Integer groupId, ChatGroupRegistry chatGroupRegistry) {
        this.groupId = groupId;
        this.chatGroupRegistry = chatGroupRegistry;
    }

    @Override
    public boolean accept(String sessionId, IKey key) {
        boolean accept = false;
        try {
            GroupState groupState = chatGroupRegistry.getGroup(groupId);
            Set<GroupMember> groupMembers = groupState.getGroupMembers();
            for (GroupMember groupMember : groupMembers) {
                logger.debug("check accept group member: {},{},{}", groupMember.uid(), groupMember.displayName(), groupMember.sessionId());
                if (sessionId.equals(groupMember.sessionId())) {
                    accept = true;
                    break;
                }
            }
            logger.debug("accept group members: {},{},{}", groupMembers, sessionId, groupId);
            logger.debug("group msg filter accepted : {}", accept);
        } catch (Exception e) {
            logger.debug("Cannot find GroupSate : {}\n{}", groupId, e.getMessage());
        }
        return accept;


    }
}
