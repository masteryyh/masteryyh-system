package win.masteryyh.masteryyhsystem.base.utils;

import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.model.StoredFile;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

@Component
public class StaticArchiveValidator {
    private final S3FileManager storage;

    private final int maxFiles;

    private final long maxUncompressedSize;

    public StaticArchiveValidator(S3FileManager storage,
                                  @Value("${system.gateway.max-static-files:10000}") int maxFiles,
                                  @Value("${system.gateway.max-static-uncompressed-size:536870912}")
                                  long maxUncompressedSize) {
        this.storage = storage;
        this.maxFiles = maxFiles;
        this.maxUncompressedSize = maxUncompressedSize;
    }

    public void validate(StoredFile file) {
        if (!file.getOriginalFilename().toLowerCase().endsWith(".zip")) {
            throw new BusinessException(400, "error.gatewayRoute.staticFile.zipRequired",
                    "Static resource file must be a ZIP archive");
        }

        int fileCount = 0;
        long totalSize = 0;
        boolean rootFileFound = false;
        Set<String> topLevelNames = new HashSet<>();
        try (var object = storage.get(file.getObjectKey());
             ZipArchiveInputStream zip = new ZipArchiveInputStream(new BufferedInputStream(object))) {
            ZipArchiveEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                String name = normalize(entry.getName());
                if (name.isBlank()) {
                    continue;
                }
                if (name.startsWith("/") || name.equals("..") || name.startsWith("../")
                        || name.contains("/../") || entry.isUnixSymlink()) {
                    throw invalid("ZIP contains an unsafe path: " + entry.getName());
                }
                String first = name.contains("/") ? name.substring(0, name.indexOf('/')) : name;
                topLevelNames.add(first);
                if (!entry.isDirectory()) {
                    fileCount++;
                    rootFileFound |= !name.contains("/");
                    if (fileCount > maxFiles) {
                        throw invalid("ZIP contains too many files");
                    }
                    int read;
                    while ((read = zip.read(buffer)) != -1) {
                        totalSize += read;
                        if (totalSize > maxUncompressedSize) {
                            throw invalid("ZIP uncompressed size exceeds the limit");
                        }
                    }
                }
            }
        } catch (IOException e) {
            throw invalid("Failed to read ZIP archive: " + e.getMessage());
        }

        if (fileCount == 0) {
            throw invalid("ZIP archive contains no files");
        }
        if (!rootFileFound && topLevelNames.size() == 1) {
            throw invalid("ZIP files must be placed at archive root, without a wrapping directory");
        }
    }

    private static String normalize(String name) {
        return name.replace('\\', '/');
    }

    private static BusinessException invalid(String message) {
        return new BusinessException(400, "error.gatewayRoute.staticFile.invalid", message);
    }
}
