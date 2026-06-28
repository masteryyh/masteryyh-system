package win.masteryyh.masteryyhsystem.base.utils;

import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream;
import org.springframework.stereotype.Component;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.model.StoredFile;

import java.io.BufferedInputStream;
import java.io.IOException;

@Component
public class StaticArchiveValidator {
    private final S3FileManager storage;

    public StaticArchiveValidator(S3FileManager storage) {
        this.storage = storage;
    }

    public void validate(StoredFile file) {
        if (!file.getOriginalFilename().toLowerCase().endsWith(".zip")) {
            throw new BusinessException(400, "error.gatewayRoute.staticFile.zipRequired",
                    "Static resource file must be a ZIP archive");
        }

        try (var object = storage.get(file.getObjectKey());
             ZipArchiveInputStream zip = new ZipArchiveInputStream(new BufferedInputStream(object))) {
            ZipArchiveEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = normalize(entry.getName());
                if (name.isBlank()) {
                    continue;
                }
                if (name.startsWith("/") || name.equals("..") || name.startsWith("../")
                        || name.contains("/../") || entry.isUnixSymlink()) {
                    throw invalid("ZIP contains an unsafe path: " + entry.getName());
                }
            }
        } catch (IOException e) {
            throw invalid("Failed to read ZIP archive: " + e.getMessage());
        }
    }

    private static String normalize(String name) {
        return name.replace('\\', '/');
    }

    private static BusinessException invalid(String message) {
        return new BusinessException(400, "error.gatewayRoute.staticFile.invalid", message);
    }
}
