package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.NotBlank;

public record NginxParseRequest(
        @NotBlank(message = "validation.gateway.nginxConfig.notBlank") String configContent) {
}
