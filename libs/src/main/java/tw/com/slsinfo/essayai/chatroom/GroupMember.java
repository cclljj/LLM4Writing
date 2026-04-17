package tw.com.slsinfo.essayai.chatroom;

import jakarta.validation.constraints.NotNull;

import java.io.Serializable;

/**
 * 小組成員資料
 *
 * @param uid
 * @param displayName
 */
public record GroupMember(@NotNull String uid, @NotNull String displayName,
                          @NotNull String sessionId) implements Serializable {
}
