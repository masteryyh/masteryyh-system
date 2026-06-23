package win.masteryyh.masteryyhsystem.model.dto;

import io.micrometer.common.util.StringUtils;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;

import java.util.List;
import java.util.UUID;

public record AddAppPlatformDto(@NotBlank(message = "validation.platform.name.notBlank") String name,
                                String description,
                                @NotNull(message = "validation.platform.type.notNull") PlatformType platformType,
                                InitSystem initSystem,
                                String dockerHost,
                                String sshHost,
                                @Min(value = 1, message = "validation.platform.sshPort.min")
                                @Max(value = 65535, message = "validation.platform.sshPort.max") Integer sshPort,
                                String sshUsername,
                                UUID credentialId,
                                List<String> hostKeys) {
    public void validate() {
        if (platformType.equals(PlatformType.DOCKER)) {
            if (StringUtils.isBlank(dockerHost)) {
                throw new BusinessException(400, "error.platform.dockerHost.empty",
                        "Docker host cannot be empty");
            }
        } else if (platformType.equals(PlatformType.HOST)) {
            if (initSystem == null) {
                throw new BusinessException(400, "error.platform.initSystem.empty",
                        "Init system cannot be empty");
            }
            if (StringUtils.isBlank(sshHost)) {
                throw new BusinessException(400, "error.platform.sshHost.empty",
                        "SSH host cannot be empty");
            }
            if (StringUtils.isBlank(sshUsername)) {
                throw new BusinessException(400, "error.platform.sshUsername.empty",
                        "SSH username cannot be empty");
            }
        }
    }
}
