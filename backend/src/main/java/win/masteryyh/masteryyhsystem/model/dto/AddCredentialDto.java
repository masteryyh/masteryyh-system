package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.apache.commons.lang3.StringUtils;
import win.masteryyh.masteryyhsystem.base.consts.GenericConsts;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;

public record AddCredentialDto(@NotBlank(message = "Credential name cannot be blank") String name,
                               String description,
                               @NotNull(message = "Credential type cannot be null") CredentialType credentialType,
                               String sshPublicKey,
                               String sshPrivateKey,
                               String sshPrivateKeyPassphrase,
                               String password) {
    public void validate() {
        switch (credentialType) {
            case SSH_PUBLIC_KEY -> {
                if (StringUtils.isBlank(sshPublicKey)) {
                    throw new BusinessException(400, "SSH public key cannot be empty");
                }

                if (!GenericConsts.OPENSSH_PUBLIC_KEY.matcher(sshPublicKey).matches()) {
                    throw new BusinessException(400, "SSH public key is not valid");
                }

                if (sshPublicKey.split(" ").length < 2) {
                    throw new BusinessException(400, "SSH public key is not valid");
                }
            }
            case SSH_PRIVATE_KEY -> {
                if (StringUtils.isBlank(sshPrivateKey)) {
                    throw new BusinessException(400, "SSH private key cannot be empty");
                }

                if (!GenericConsts.OPENSSH_PRIVATE_KEY.matcher(sshPrivateKey).matches()) {
                    throw new BusinessException(400, "SSH private key invalid");
                }
            }
            case TEXT_PASSWORD -> {
                if (StringUtils.isBlank(password)) {
                    throw new BusinessException(400, "Password cannot be empty");
                }
            }
        }
    }
}
