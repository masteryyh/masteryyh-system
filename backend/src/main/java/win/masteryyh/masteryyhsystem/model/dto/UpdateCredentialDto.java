package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateCredentialDto(@NotBlank(message = "Credential name cannot be blank") String name,
                                  String description) {
}
