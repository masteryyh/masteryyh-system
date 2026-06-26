package win.masteryyh.masteryyhsystem.base.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record WsEvent(String type, String channel, String event, Object data) {
    public WsEvent(String channel, String event, Object data) {
        this("event", channel, event, data);
    }
}
