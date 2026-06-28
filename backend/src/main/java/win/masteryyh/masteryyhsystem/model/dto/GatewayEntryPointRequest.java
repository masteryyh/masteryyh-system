package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

public record GatewayEntryPointRequest(
        @NotBlank(message = "validation.gatewayEntryPoint.name.notBlank") String name,
        @Min(value = 1, message = "validation.gatewayEntryPoint.port.min")
        @Max(value = 65535, message = "validation.gatewayEntryPoint.port.max") int listenPort,
        @NotEmpty(message = "validation.gatewayEntryPoint.domains.notEmpty") List<String> domainNames,
        UUID certificateCredentialId,
        GatewayExtraConfig extraConfig) {
}
