package win.masteryyh.masteryyhsystem.model.dto;

import io.micrometer.common.util.StringUtils;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;

import java.util.UUID;

public record AddGatewayConfigDto(@NotBlank(message = "validation.gateway.name.notBlank") String name,
                                  String description,
                                  @NotNull(message = "validation.gateway.platformId.notNull") UUID platformId,
                                  String appVersion,
                                  String containerImage,
                                  String containerConfigPath,
                                  String configContent) {
    public void validate(PlatformType platformType) {
        if (platformType == null) {
            throw new BusinessException(400, "error.gateway.platformType.unknown", "Unknown platform type");
        }
        if (platformType.equals(PlatformType.DOCKER)) {
            if (StringUtils.isBlank(containerImage)) {
                throw new BusinessException(400, "error.gateway.containerImage.empty", "Container image cannot be empty for DOCKER platform");
            }
        } else if (platformType.equals(PlatformType.HOST)) {
            if (StringUtils.isBlank(appVersion)) {
                throw new BusinessException(400, "error.gateway.appVersion.empty", "App version cannot be empty for HOST platform");
            }
        }
    }
}
