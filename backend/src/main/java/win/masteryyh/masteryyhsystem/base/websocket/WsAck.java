package win.masteryyh.masteryyhsystem.base.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record WsAck(String type, String action, String channel) {
    public WsAck(String action, String channel) {
        this("ack", action, channel);
    }
}
