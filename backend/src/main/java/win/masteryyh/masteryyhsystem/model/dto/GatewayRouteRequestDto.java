package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record GatewayRouteRequestDto(
        @NotBlank(message = "validation.gatewayRoute.name.notBlank") String name,
        @NotBlank(message = "validation.gatewayRoute.path.notBlank") String pathPrefix,
        @NotNull(message = "validation.gatewayRoute.type.notNull") GatewayRouteType routeType,
        @Min(value = 0, message = "validation.gatewayRoute.priority.min") int priority,
        String proxyTarget,
        UUID staticFileId) {
}
