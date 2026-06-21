package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.apache.commons.lang3.StringUtils;
import win.masteryyh.masteryyhsystem.base.consts.GenericConsts;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;

public record AddCredentialDto(@NotBlank(message = "validation.credential.name.notBlank") String name,
                               String description,
                               @NotNull(message = "validation.credential.type.notNull") CredentialType credentialType,
                               String sshPublicKey,
                               String sshPrivateKey,
                               String sshPrivateKeyPassphrase,
                               String password) {
    public void validate() {
        switch (credentialType) {
            case SSH_PUBLIC_KEY -> {
                if (StringUtils.isBlank(sshPublicKey)) {
                    throw new BusinessException(400, "error.credential.sshPublicKey.empty",
                            "SSH public key cannot be empty");
                }

                if (!GenericConsts.OPENSSH_PUBLIC_KEY.matcher(sshPublicKey).matches()) {
                    throw new BusinessException(400, "error.credential.sshPublicKey.invalid",
                            "SSH public key is not valid");
                }

                if (sshPublicKey.split(" ").length < 2) {
                    throw new BusinessException(400, "error.credential.sshPublicKey.invalid",
                            "SSH public key is not valid");
                }
            }
            case SSH_PRIVATE_KEY -> {
                if (StringUtils.isBlank(sshPrivateKey)) {
                    throw new BusinessException(400, "error.credential.sshPrivateKey.empty",
                            "SSH private key cannot be empty");
                }

                if (!GenericConsts.OPENSSH_PRIVATE_KEY.matcher(sshPrivateKey).matches()) {
                    throw new BusinessException(400, "error.credential.sshPrivateKey.invalid",
                            "SSH private key invalid");
                }
            }
            case TEXT_PASSWORD -> {
                if (StringUtils.isBlank(password)) {
                    throw new BusinessException(400, "error.credential.password.empty",
                            "Password cannot be empty");
                }
            }
        }
    }
}
