package win.masteryyh.masteryyhsystem.model.dto;

import java.io.Serializable;
import java.util.regex.Pattern;

public record GatewayExtraConfig(Boolean webSocket, String clientMaxBodySize) implements Serializable {
    private static final Pattern BODY_SIZE = Pattern.compile("(?i)^\\d+(k|m|g)?$");

    public static GatewayExtraConfig empty() {
        return new GatewayExtraConfig(null, null);
    }

    public boolean hasWebSocket() {
        return webSocket != null;
    }

    public boolean webSocketEnabled() {
        return Boolean.TRUE.equals(webSocket);
    }

    public boolean hasClientMaxBodySize() {
        return clientMaxBodySize != null && !clientMaxBodySize.isBlank();
    }

    public String normalizedClientMaxBodySize() {
        return hasClientMaxBodySize() ? clientMaxBodySize.trim() : null;
    }

    public boolean clientMaxBodySizeValid() {
        if (!hasClientMaxBodySize()) {
            return true;
        }
        return BODY_SIZE.matcher(clientMaxBodySize.trim()).matches();
    }

    /**
     * 计算路由级覆盖入口级后的生效配置：路由级非空字段覆盖入口级，未设置字段沿用入口级。
     */
    public static GatewayExtraConfig effective(GatewayExtraConfig routeOverride, GatewayExtraConfig entryDefault) {
        GatewayExtraConfig route = routeOverride == null ? empty() : routeOverride;
        GatewayExtraConfig entry = entryDefault == null ? empty() : entryDefault;
        Boolean ws = route.hasWebSocket() ? route.webSocket : entry.webSocket;
        String body = route.hasClientMaxBodySize()
                ? route.normalizedClientMaxBodySize()
                : entry.normalizedClientMaxBodySize();
        return new GatewayExtraConfig(ws, body);
    }
}
