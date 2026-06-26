package win.masteryyh.masteryyhsystem.model.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateStoredFileDto(
        @NotBlank(message = "validation.file.name.notBlank") String name,
        String description) {
}
