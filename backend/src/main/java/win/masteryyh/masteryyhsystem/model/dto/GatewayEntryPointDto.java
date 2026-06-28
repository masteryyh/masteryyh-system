package win.masteryyh.masteryyhsystem.model.dto;

import win.masteryyh.masteryyhsystem.model.GatewayEntryPoint;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record GatewayEntryPointDto(UUID id, UUID gatewayId, String name, int listenPort,
                                   List<String> domainNames, UUID certificateCredentialId,
                                   String currentConfigContent, String lastConfigContent,
                                   LocalDateTime createdAt, LocalDateTime updatedAt) {
    public static GatewayEntryPointDto from(GatewayEntryPoint entryPoint) {
        return new GatewayEntryPointDto(entryPoint.getId(), entryPoint.getGatewayId(),
                entryPoint.getName(), entryPoint.getListenPort(), entryPoint.getDomainNames(),
                entryPoint.getCertificateCredentialId(), entryPoint.getCurrentConfigContent(),
                entryPoint.getLastConfigContent(), entryPoint.getCreatedAt(), entryPoint.getUpdatedAt());
    }
}
