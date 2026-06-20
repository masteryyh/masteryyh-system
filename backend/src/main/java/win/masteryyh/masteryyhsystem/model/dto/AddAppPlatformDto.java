package win.masteryyh.masteryyhsystem.model.dto;

import io.micrometer.common.util.StringUtils;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;

import java.util.List;
import java.util.UUID;

public record AddAppPlatformDto(@NotBlank(message = "Name cannot be blank") String name,
                                String description,
                                @NotNull(message = "Platform type cannot be null") PlatformType platformType,
                                String dockerHost,
                                String systemdSSHHost,
                                @Min(value = 1, message = "SSH port cannot below 1") @Max(value = 65535, message = "SSH port cannot above 65535") Integer systemdSSHPort,
                                String systemdSSHUsername,
                                UUID credentialId,
                                List<String> hostKeys) {
    public void validate() {
        if (platformType.equals(PlatformType.DOCKER)) {
            if (StringUtils.isBlank(dockerHost)) {
                throw new BusinessException(400, "Docker host cannot be empty");
            }
        } else if (platformType.equals(PlatformType.SYSTEMD)) {
            if (StringUtils.isBlank(systemdSSHHost)) {
                throw new BusinessException(400, "SSH host cannot be empty");
            }
            if (StringUtils.isBlank(systemdSSHUsername)) {
                throw new BusinessException(400, "SSH username cannot be empty");
            }
        }
    }
}
