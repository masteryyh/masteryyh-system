package win.masteryyh.masteryyhsystem.base.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import win.masteryyh.masteryyhsystem.base.utils.JwtUtils;

import java.net.URI;
import java.util.Map;

/**
 * Handshake interceptor for the generic pub/sub WebSocket endpoint ({@code /v1/ws}). Unlike
 * {@link WebSocketHandshakeAuthInterceptor} (which also binds a platformId from the path), this one
 * only validates the {@code token} query parameter and lets clients subscribe to arbitrary channels
 * after the handshake.
 */
@Component
public class GenericWsHandshakeAuthInterceptor implements HandshakeInterceptor {
    private static final Logger logger = LoggerFactory.getLogger(GenericWsHandshakeAuthInterceptor.class);

    private final JwtUtils jwtUtils;

    public GenericWsHandshakeAuthInterceptor(JwtUtils jwtUtils) {
        this.jwtUtils = jwtUtils;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String token = extractQuery(request.getURI(), "token");
        if (token == null || token.isBlank()) {
            return false;
        }
        try {
            jwtUtils.validateToken(token);
        } catch (Exception e) {
            logger.warn("Generic WS handshake rejected: invalid token");
            return false;
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // no-op
    }

    private static String extractQuery(URI uri, String key) {
        String query = uri.getQuery();
        if (query == null) {
            return null;
        }
        for (String pair : query.split("&")) {
            int idx = pair.indexOf('=');
            if (idx > 0 && pair.substring(0, idx).equals(key)) {
                return pair.substring(idx + 1);
            }
        }
        return null;
    }
}
