package win.masteryyh.masteryyhsystem.base.websocket;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class GenericWebSocketHandler extends TextWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(GenericWebSocketHandler.class);

    private final ObjectMapper mapper;

    private final EventBroadcaster broadcaster;

    private final Map<String, Subscriber> subscribers;

    private final Map<String, Set<String>> sessionChannels;

    private final Map<String, WebSocketSession> sessions;

    public GenericWebSocketHandler(ObjectMapper mapper,
                                   EventBroadcaster broadcaster) {
        this.mapper = mapper;
        this.broadcaster = broadcaster;

        this.subscribers = new ConcurrentHashMap<>();
        this.sessionChannels = new ConcurrentHashMap<>();
        this.sessions = new ConcurrentHashMap<>();
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.put(session.getId(), session);
        sessionChannels.put(session.getId(), ConcurrentHashMap.newKeySet());
        subscribers.put(session.getId(), json -> deliver(session, json));
        send(session, new WsConnected());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        WsClientMessage msg;
        try {
            msg = mapper.readValue(message.getPayload(), WsClientMessage.class);
        } catch (Exception e) {
            send(session, new WsError("Invalid message: " + e.getMessage()));
            return;
        }

        String type = msg.type() == null ? "" : msg.type();
        String channel = msg.channel();
        switch (type) {
            case "subscribe" -> {
                if (StringUtils.isBlank(channel)) {
                    send(session, new WsError("subscribe requires a channel"));
                    return;
                }
                Set<String> chans = sessionChannels.get(session.getId());
                Subscriber sub = subscribers.get(session.getId());
                if (chans != null && sub != null && chans.add(channel)) {
                    broadcaster.subscribe(channel, sub);
                }
                send(session, new WsAck("subscribe", channel));
            }
            case "unsubscribe" -> {
                if (StringUtils.isBlank(channel)) {
                    send(session, new WsError("unsubscribe requires a channel"));
                    return;
                }
                Set<String> chans = sessionChannels.get(session.getId());
                Subscriber sub = subscribers.get(session.getId());
                if (chans != null && sub != null && chans.remove(channel)) {
                    broadcaster.unsubscribe(channel, sub);
                }
                send(session, new WsAck("unsubscribe", channel));
            }
            case "ping" -> send(session, new WsPong());
            default -> send(session, new WsError("Unknown message type: " + type));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Subscriber sub = subscribers.remove(session.getId());
        sessionChannels.remove(session.getId());
        sessions.remove(session.getId());
        if (sub != null) {
            broadcaster.removeAll(sub);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        logger.warn("Generic WS transport error for {}: {}", session.getId(), exception.getMessage());
        Subscriber sub = subscribers.remove(session.getId());
        if (sub != null) {
            broadcaster.removeAll(sub);
        }
        try {
            session.close(CloseStatus.SERVER_ERROR);
        } catch (IOException ignored) {
        }
    }

    private void deliver(WebSocketSession session, String json) {
        if (session != null && session.isOpen()) {
            try {
                session.sendMessage(new TextMessage(json));
            } catch (IOException e) {
                logger.debug("Failed to push event to {}: {}", session.getId(), e.getMessage());
            }
        }
    }

    private void send(WebSocketSession session, Object payload) {
        if (!session.isOpen()) {
            return;
        }
        try {
            session.sendMessage(new TextMessage(mapper.writeValueAsString(payload)));
        } catch (IOException e) {
            logger.debug("Failed to send to {}: {}", session.getId(), e.getMessage());
        }
    }
}
