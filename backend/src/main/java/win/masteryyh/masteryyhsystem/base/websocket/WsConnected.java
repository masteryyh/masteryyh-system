package win.masteryyh.masteryyhsystem.base.websocket;

public record WsConnected(String type) {
    public WsConnected() {
        this("connected");
    }
}
