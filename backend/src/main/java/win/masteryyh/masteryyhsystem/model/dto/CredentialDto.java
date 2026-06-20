package win.masteryyh.masteryyhsystem.model.dto;

import win.masteryyh.masteryyhsystem.base.utils.crypto.SSHKeyInfo;
import win.masteryyh.masteryyhsystem.model.Credential;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

public record CredentialDto(UUID id, String name, String description, CredentialType credentialType,
                            String sshPublicKey, SSHKeyInfo sshKeyInfo, LocalDateTime createdAt,
                            LocalDateTime updatedAt) implements Serializable {
    public static CredentialDto from(Credential credential) {
        return new CredentialDto(credential.getId(), credential.getName(), credential.getDescription(), credential.getCredentialType(),
                credential.getSshPublicKey(), credential.getSshKeyInfo(), credential.getCreatedAt(), credential.getUpdatedAt());
    }
}