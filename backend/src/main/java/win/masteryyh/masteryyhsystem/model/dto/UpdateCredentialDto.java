package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateCredentialDto(@NotBlank(message = "validation.credential.name.notBlank") String name,
                                  String description) {
}
