package tw.com.slsinfo.essayai.chatroom;

import tw.com.slsinfo.essayai.models.openai.ChatPageModel;

import java.util.Optional;

/**
 * 群聊事件Payload，包含要帶給WebSocket的ChatEventType
 *
 * @param groupId
 * @param chatEventType
 * @param chatPageModel
 * @param payload
 */
public record ChatEvent(int groupId, ChatEventType chatEventType, Optional<ChatPageModel> chatPageModel,
                        Object payload) {
}
