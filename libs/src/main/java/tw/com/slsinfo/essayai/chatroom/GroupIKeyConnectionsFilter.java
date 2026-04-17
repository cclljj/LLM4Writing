package tw.com.slsinfo.essayai.chatroom;


import org.apache.wicket.protocol.ws.api.registry.IKey;
import org.apache.wicket.protocol.ws.api.registry.IWebSocketConnectionRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;
import java.util.Set;


/**
 * 客制化小組訊息target filter<br>
 * 以grouId與Page Ikey為主要Filter
 */
public class GroupIKeyConnectionsFilter implements IWebSocketConnectionRegistry.IConnectionsFilter {

    private static final Logger logger = LoggerFactory.getLogger(GroupIKeyConnectionsFilter.class);
    private final Optional<Integer> groupId;
    private final ChatGroupRegistry chatGroupRegistry;


    /**
     *
     * @param groupId           小組編號
     * @param chatGroupRegistry 小組登錄資料
     */
    public GroupIKeyConnectionsFilter(Optional<Integer> groupId, ChatGroupRegistry chatGroupRegistry) {
        this.groupId = groupId;
        this.chatGroupRegistry = chatGroupRegistry;
    }

    @Override
    public boolean accept(String sessionId, IKey key) {
        if (groupId.isPresent()) {
            GroupState groupState = chatGroupRegistry.getGroup(groupId.get());
            Set<GroupMember> groupMembers = groupState.getGroupMembers();
            boolean accept = false;
            for (GroupMember groupMember : groupMembers) {
                logger.debug("check accept group member: {},{},{}", groupMember.uid(), groupMember.displayName(), groupMember.sessionId());
                if (sessionId.equals(groupMember.sessionId()) && key.getContext().equals(groupState.getCurrentPageIKey().get().getContext())) {
                    accept = true;
                    break;
                }
            }
            logger.debug("accept group members: {},{},{}", groupMembers, sessionId, groupId);
            logger.debug("IKey Context : {}", key.getContext());
            logger.debug("Current IKey Context : {}", groupState.getCurrentPageIKey().get().getContext());
            logger.debug("group msg filter accepted : {}", accept);
            return accept;
        } else {
            return false;
        }


    }
}
