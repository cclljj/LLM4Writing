package tw.com.slsinfo.essayai.utils;

import org.apache.logging.log4j.Marker;
import org.apache.logging.log4j.MarkerManager;
import tw.com.slsinfo.essayai.databases.mongo.entities.log4j2.EventType;

/**
 * 用來辨別Log4J記錄內容項目
 */
public interface AIMarker {
    Marker READY_TO_SEND_PROMPT = MarkerManager.getMarker(EventType.READY_TO_SEND_PROMPT.getName());
    Marker READY_TO_SEND_TREE_PROMPT = MarkerManager.getMarker(EventType.READY_TO_SEND_PROMPT.getName());
    Marker READY_TO_SEND_JUDGE_COMPOSE = MarkerManager.getMarker(EventType.READY_TO_SEND_JUDGE_COMPOSE.getName());
    Marker GOT_AI_RESPONSE = MarkerManager.getMarker(EventType.GOT_AI_RESPONSE.getName());
    Marker GOT_AI_TREE_RESPONSE = MarkerManager.getMarker(EventType.GOT_AI_TREE_RESPONSE.getName());
    Marker GOT_AI_JUDGE_RESPONSE = MarkerManager.getMarker(EventType.GOT_AI_JUDGE_RESPONSE.getName());
}
