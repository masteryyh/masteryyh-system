package win.masteryyh.masteryyhsystem.model.dto;

import win.masteryyh.masteryyhsystem.model.GatewayConfig;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

public record GatewayConfigDto(UUID id, String name, String description, UUID platformId,
                               String appVersion, String containerImage, String containerConfigPath,
                               String containerId, String containerName, String systemdServiceName,
                               String localConfigPath, String configContent, GatewayStatus status,
                               boolean pendingChanges, LocalDateTime createdAt, LocalDateTime updatedAt) implements Serializable {
    public static GatewayConfigDto from(GatewayConfig cfg) {
        return new GatewayConfigDto(cfg.getId(), cfg.getName(), cfg.getDescription(), cfg.getPlatformId(),
                cfg.getAppVersion(), cfg.getContainerImage(), cfg.getContainerConfigPath(),
                cfg.getContainerId(), cfg.getContainerName(), cfg.getSystemdServiceName(),
                cfg.getLocalConfigPath(), cfg.getConfigContent(), cfg.getStatus(),
                cfg.isPendingChanges(), cfg.getCreatedAt(), cfg.getUpdatedAt());
    }
}
