package win.masteryyh.masteryyhsystem.service;

import org.apache.commons.codec.digest.DigestUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import win.masteryyh.masteryyhsystem.base.config.SystemConfiguration;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.base.page.PageDataRequest;
import win.masteryyh.masteryyhsystem.base.page.PagedResponse;
import win.masteryyh.masteryyhsystem.base.utils.S3FileManager;
import win.masteryyh.masteryyhsystem.model.StoredFile;
import win.masteryyh.masteryyhsystem.model.dto.FileDownloadDto;
import win.masteryyh.masteryyhsystem.model.dto.StoredFileDto;
import win.masteryyh.masteryyhsystem.repository.GatewayRouteRepository;
import win.masteryyh.masteryyhsystem.repository.StoredFileRepository;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.UUID;

@Service
public class StoredFileService {
    private final StoredFileRepository repository;
    
    private final S3FileManager s3;
    
    private final GatewayRouteRepository routeRepository;
    
    private final long maxSize;

    public StoredFileService(StoredFileRepository repository,
                             S3FileManager s3,
                             GatewayRouteRepository routeRepository,
                             SystemConfiguration configuration) {
        this.repository = repository;
        this.s3 = s3;
        this.routeRepository = routeRepository;
        this.maxSize = configuration.getFile().getMaxSize();
    }

    @Transactional(readOnly = true)
    public PagedResponse<StoredFileDto> page(PageDataRequest request) {
        Page<StoredFile> page = repository.findAll(PageRequest.of(request.page() - 1, request.pageSize(),
                Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("createdAt"))));
        List<StoredFileDto> data = page.getContent().stream().map(StoredFileDto::from).toList();
        return new PagedResponse<>(data, request.page(), request.pageSize(),
                (int) Math.ceil((double) page.getTotalElements() / request.pageSize()),
                page.getTotalElements());
    }

    @Transactional(readOnly = true)
    public StoredFileDto get(UUID id) {
        return StoredFileDto.from(find(id));
    }

    @Transactional(rollbackFor = Exception.class)
    public StoredFileDto add(String name, String description, MultipartFile upload) throws IOException {
        validateUpload(name, upload);
        String resolvedName = resolveAvailableName(name.trim());

        String objectKey = "files/" + UUID.randomUUID() + "/" + safeFilename(upload.getOriginalFilename());
        String sha256;
        try (InputStream input = upload.getInputStream()) {
            sha256 = DigestUtils.sha256Hex(input);
        }
        try (InputStream input = upload.getInputStream()) {
            s3.put(objectKey, contentType(upload), upload.getSize(), input);
        }

        try {
            StoredFile file = new StoredFile();
            file.setName(resolvedName);
            file.setDescription(description);
            file.setOriginalFilename(safeFilename(upload.getOriginalFilename()));
            file.setContentType(contentType(upload));
            file.setSize(upload.getSize());
            file.setSha256(sha256);
            file.setObjectKey(objectKey);
            return StoredFileDto.from(repository.save(file));
        } catch (RuntimeException e) {
            s3.delete(objectKey);
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public FileDownloadDto download(UUID id) {
        StoredFile file = find(id);
        ResponseInputStream<GetObjectResponse> stream = s3.get(file.getObjectKey());
        return new FileDownloadDto(file.getOriginalFilename(), file.getContentType(),
                file.getSize(), stream);
    }

    @Transactional(rollbackFor = Exception.class)
    public void remove(UUID id) {
        StoredFile file = find(id);
        if (routeRepository.existsByStaticFileId(id)) {
            throw new BusinessException(409, "error.file.occupied",
                    "File is in use");
        }
        repository.delete(file);
        repository.flush();
        s3.delete(file.getObjectKey());
    }

    public StoredFile find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "error.file.notFound", "File not found"));
    }

    private void validateUpload(String name, MultipartFile upload) {
        if (StringUtils.isBlank(name)) {
            throw new BusinessException(400, "validation.file.name.notBlank", "Filename cannot be blank");
        }
        if (upload == null || upload.isEmpty()) {
            throw new BusinessException(400, "error.file.empty", "Uploaded file cannot be empty");
        }
        if (upload.getSize() > maxSize) {
            throw new BusinessException(413, "error.file.tooLarge", "Uploaded file exceeds the size limit");
        }
    }

    private static String safeFilename(String filename) {
        if (StringUtils.isBlank(filename)) {
            return "upload.bin";
        }
        String normalized = filename.replace('\\', '/');
        return normalized.substring(normalized.lastIndexOf('/') + 1);
    }

    private static String contentType(MultipartFile upload) {
        return upload.getContentType() == null ? "application/octet-stream" : upload.getContentType();
    }

    private String resolveAvailableName(String requestedName) {
        if (!repository.existsByName(requestedName)) {
            return requestedName;
        }

        String candidate;
        do {
            String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
            candidate = requestedName + "-" + suffix;
        } while (repository.existsByName(candidate));
        return candidate;
    }
}
