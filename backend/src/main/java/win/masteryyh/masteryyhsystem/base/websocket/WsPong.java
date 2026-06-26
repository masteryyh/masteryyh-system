package win.masteryyh.masteryyhsystem.base.websocket;

public record WsPong(String type) {
    public WsPong() {
        this("pong");
    }
}
