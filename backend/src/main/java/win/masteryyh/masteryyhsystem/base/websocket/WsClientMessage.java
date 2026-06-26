package win.masteryyh.masteryyhsystem.base.websocket;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record WsClientMessage(String type, String channel) {
}
