package win.masteryyh.masteryyhsystem.model.dto;

import win.masteryyh.masteryyhsystem.model.StoredFile;

import java.time.LocalDateTime;
import java.util.UUID;

public record StoredFileDto(UUID id, String name, String description, String originalFilename,
                            String contentType, long size, String sha256,
                            LocalDateTime createdAt, LocalDateTime updatedAt) {
    public static StoredFileDto from(StoredFile file) {
        return new StoredFileDto(file.getId(), file.getName(), file.getDescription(),
                file.getOriginalFilename(), file.getContentType(), file.getSize(), file.getSha256(),
                file.getCreatedAt(), file.getUpdatedAt());
    }
}
