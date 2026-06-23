package win.masteryyh.masteryyhsystem.model.dto;

import win.masteryyh.masteryyhsystem.model.AppPlatform;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record AppPlatformDto(UUID id, String name, String description, PlatformType platformType, InitSystem initSystem,
                             String dockerHost, String sshHost, Integer sshPort, String sshUsername, UUID credentialId,
                             List<String> hostKeys, boolean online, LocalDateTime createdAt, LocalDateTime updatedAt) implements Serializable {
    public static AppPlatformDto from(AppPlatform appPlatform, boolean online) {
        return new AppPlatformDto(appPlatform.getId(), appPlatform.getName(), appPlatform.getDescription(), appPlatform.getPlatformType(),
                appPlatform.getInitSystem(), appPlatform.getDockerHost(), appPlatform.getSshHost(), appPlatform.getSshPort(), appPlatform.getSshUsername(),
                appPlatform.getCredentialId(), appPlatform.getHostKeys(), online, appPlatform.getCreatedAt(), appPlatform.getUpdatedAt());
    }
}
