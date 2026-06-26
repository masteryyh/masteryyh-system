package win.masteryyh.masteryyhsystem.base.websocket;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record WsError(String type, String message) {
    public WsError(String message) {
        this("error", message);
    }
}
