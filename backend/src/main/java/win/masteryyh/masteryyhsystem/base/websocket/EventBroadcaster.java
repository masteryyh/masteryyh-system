package win.masteryyh.masteryyhsystem.base.websocket;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class EventBroadcaster {
    private static final Logger logger = LoggerFactory.getLogger(EventBroadcaster.class);

    private final ObjectMapper mapper;

    private final Map<String, Set<Subscriber>> subscribers = new ConcurrentHashMap<>();

    public EventBroadcaster(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public void subscribe(String channel, Subscriber subscriber) {
        subscribers.computeIfAbsent(channel, k -> ConcurrentHashMap.newKeySet()).add(subscriber);
    }

    public void unsubscribe(String channel, Subscriber subscriber) {
        Set<Subscriber> set = subscribers.get(channel);
        if (set != null) {
            set.remove(subscriber);
        }
    }

    public void removeAll(Subscriber subscriber) {
        subscribers.values().forEach(set -> set.remove(subscriber));
    }

    public void publish(String channel, String event, Object data) {
        Set<Subscriber> set = subscribers.get(channel);
        if (set == null || set.isEmpty()) {
            return;
        }

        String json;
        try {
            json = mapper.writeValueAsString(new WsEvent(channel, event, data));
        } catch (Exception e) {
            logger.warn("Failed to serialize event for channel {}: {}", channel, e.getMessage());
            return;
        }
        for (Subscriber s : set) {
            try {
                s.deliver(json);
            } catch (Exception e) {
                logger.debug("Failed to deliver event on {}: {}", channel, e.getMessage());
            }
        }
    }
}
