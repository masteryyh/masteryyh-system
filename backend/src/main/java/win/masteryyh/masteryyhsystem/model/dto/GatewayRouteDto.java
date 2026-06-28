package win.masteryyh.masteryyhsystem.model.dto;

import win.masteryyh.masteryyhsystem.model.GatewayRoute;

import java.time.LocalDateTime;
import java.util.UUID;

public record GatewayRouteDto(UUID id, UUID entryPointId, String name, String pathPrefix,
                              GatewayRouteType routeType, int priority, String proxyTarget,
                              UUID staticFileId, GatewayExtraConfig extraConfig,
                              LocalDateTime createdAt, LocalDateTime updatedAt) {
    public static GatewayRouteDto from(GatewayRoute route) {
        return new GatewayRouteDto(route.getId(), route.getEntryPointId(), route.getName(),
                route.getPathPrefix(), route.getRouteType(), route.getPriority(),
                route.getProxyTarget(), route.getStaticFileId(), route.getExtraConfig(),
                route.getCreatedAt(), route.getUpdatedAt());
    }
}
