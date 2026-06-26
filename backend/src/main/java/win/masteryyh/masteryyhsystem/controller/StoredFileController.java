package win.masteryyh.masteryyhsystem.controller;

import jakarta.validation.constraints.NotNull;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import win.masteryyh.masteryyhsystem.base.page.PageDataRequest;
import win.masteryyh.masteryyhsystem.base.page.PagedResponse;
import win.masteryyh.masteryyhsystem.base.response.IgnoreResponseAdvice;
import win.masteryyh.masteryyhsystem.model.dto.FileDownloadDto;
import win.masteryyh.masteryyhsystem.model.dto.StoredFileDto;
import win.masteryyh.masteryyhsystem.service.StoredFileService;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/v1/files")
public class StoredFileController {
    private final StoredFileService service;

    public StoredFileController(StoredFileService service) {
        this.service = service;
    }

    @GetMapping("/list")
    public PagedResponse<StoredFileDto> page(@Validated PageDataRequest request) {
        return service.page(request);
    }

    @GetMapping("/info")
    public StoredFileDto get(@RequestParam @NotNull(message = "ID cannot be null") UUID id) {
        return service.get(id);
    }

    @PostMapping(value = "/add", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public StoredFileDto add(@RequestPart String name,
                             @RequestPart(required = false) String description,
                             @RequestPart("file") MultipartFile file) throws IOException {
        return service.add(name, description, file);
    }

    @GetMapping("/download/{id}")
    @IgnoreResponseAdvice
    public ResponseEntity<StreamingResponseBody> download(@PathVariable UUID id) {
        FileDownloadDto download = service.download(id);
        StreamingResponseBody body = output -> {
            try (InputStream input = download.stream()) {
                input.transferTo(output);
            }
        };
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.contentType()))
                .contentLength(download.size())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(download.filename(), StandardCharsets.UTF_8)
                        .build().toString())
                .body(body);
    }

    @DeleteMapping("/delete/{id}")
    public void remove(@PathVariable UUID id) {
        service.remove(id);
    }
}
