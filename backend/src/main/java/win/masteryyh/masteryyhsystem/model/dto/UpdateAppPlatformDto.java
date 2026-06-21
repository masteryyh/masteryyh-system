package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.UUID;

public record UpdateAppPlatformDto(@NotBlank(message = "validation.platform.name.notBlank") String name,
                                   String description,
                                   String dockerHost,
                                   String systemdSSHHost,
                                   Integer systemdSSHPort,
                                   String systemdSSHUsername,
                                   UUID credentialId,
                                   List<String> hostKeys) {
}
