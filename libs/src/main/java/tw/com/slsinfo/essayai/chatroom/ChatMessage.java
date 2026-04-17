package tw.com.slsinfo.essayai.chatroom;

/**
 * 使用者發出的訊息
 *
 * @param uid
 * @param message
 */
public record ChatMessage(int uid, String message) {
}
