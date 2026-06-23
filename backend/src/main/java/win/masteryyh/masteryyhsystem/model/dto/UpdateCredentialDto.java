package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;

/**
 * 更新凭据。X509 类型的 {@code expiresAt} 由证书 notAfter 决定，service 层显式拒绝修改。
 * 其他类型可任意更新（传入 {@code null} 表示清除过期时间，凭据永不过期）。
 */
public record UpdateCredentialDto(@NotBlank(message = "validation.credential.name.notBlank") String name,
                                  String description,
                                  LocalDateTime expiresAt) {
}
