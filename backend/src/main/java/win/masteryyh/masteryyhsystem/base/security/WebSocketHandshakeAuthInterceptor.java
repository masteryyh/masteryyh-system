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
import java.util.UUID;

@Component
public class WebSocketHandshakeAuthInterceptor implements HandshakeInterceptor {
    private static final Logger logger = LoggerFactory.getLogger(WebSocketHandshakeAuthInterceptor.class);

    private static final int DEFAULT_COLS = 80;
    private static final int DEFAULT_ROWS = 24;
    private static final int MIN_DIM = 5;
    private static final int MAX_COLS = 500;
    private static final int MAX_ROWS = 200;

    private final JwtUtils jwtUtils;

    public WebSocketHandshakeAuthInterceptor(JwtUtils jwtUtils) {
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
            logger.warn("WebShell handshake rejected: invalid token");
            return false;
        }

        UUID platformId = extractPlatformId(request.getURI());
        if (platformId == null) {
            return false;
        }
        attributes.put("platformId", platformId);
        attributes.put("cols", clampInt(extractQuery(request.getURI(), "cols"), DEFAULT_COLS, MIN_DIM, MAX_COLS));
        attributes.put("rows", clampInt(extractQuery(request.getURI(), "rows"), DEFAULT_ROWS, MIN_DIM, MAX_ROWS));
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

    private static UUID extractPlatformId(URI uri) {
        String path = uri.getPath();
        if (path == null) {
            return null;
        }
        int idx = path.lastIndexOf('/');
        if (idx < 0 || idx == path.length() - 1) {
            return null;
        }
        try {
            return UUID.fromString(path.substring(idx + 1));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static int clampInt(String value, int fallback, int min, int max) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            int v = Integer.parseInt(value);
            return Math.max(min, Math.min(max, v));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
