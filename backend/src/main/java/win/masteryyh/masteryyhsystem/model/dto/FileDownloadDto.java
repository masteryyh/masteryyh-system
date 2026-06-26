package win.masteryyh.masteryyhsystem.model.dto;

import java.io.InputStream;

public record FileDownloadDto(String filename,
                              String contentType,
                              long size,
                              InputStream stream) {
}
