package win.masteryyh.masteryyhsystem.base.websocket;

@FunctionalInterface
public interface Subscriber {
    void deliver(String payload);
}
