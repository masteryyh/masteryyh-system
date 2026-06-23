package win.masteryyh.masteryyhsystem.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.base.page.PageDataRequest;
import win.masteryyh.masteryyhsystem.base.page.PagedResponse;
import win.masteryyh.masteryyhsystem.base.utils.AsyncTaskExecutor;
import win.masteryyh.masteryyhsystem.model.AppPlatform;
import win.masteryyh.masteryyhsystem.model.dto.AddAppPlatformDto;
import win.masteryyh.masteryyhsystem.model.dto.AppPlatformDto;
import win.masteryyh.masteryyhsystem.model.dto.PlatformType;
import win.masteryyh.masteryyhsystem.model.dto.UpdateAppPlatformDto;
import win.masteryyh.masteryyhsystem.platform.DockerManager;
import win.masteryyh.masteryyhsystem.platform.SSHManager;
import win.masteryyh.masteryyhsystem.repository.AppPlatformRepository;
import win.masteryyh.masteryyhsystem.repository.CredentialRepository;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
public class AppPlatformService {
    private static final Logger logger = LoggerFactory.getLogger(AppPlatformService.class);

    private final AppPlatformRepository appPlatformRepository;

    private final DockerManager dockerManager;

    private final SSHManager sshManager;

    private final CredentialRepository credentialRepository;

    public AppPlatformService(AppPlatformRepository appPlatformRepository,
            DockerManager dockerManager,
            SSHManager sshManager,
            CredentialRepository credentialRepository) {
        this.appPlatformRepository = appPlatformRepository;
        this.dockerManager = dockerManager;
        this.sshManager = sshManager;
        this.credentialRepository = credentialRepository;
    }

    @Transactional(rollbackFor = Exception.class)
    public PagedResponse<AppPlatformDto> page(PageDataRequest request) {
        logger.info("Requesting platform page {} size {}", request.page(), request.pageSize());

        Page<AppPlatform> platformPage = appPlatformRepository
                .findAll(PageRequest.of(request.page() - 1, request.pageSize(),
                        Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("createdAt"))));
        long total = platformPage.getTotalElements();
        List<AppPlatform> platforms = platformPage.getContent();
        logger.info("Found {} platforms for page {}, total {}", platforms.size(), request.page(), total);

        List<AppPlatformDto> dtos = platforms.stream().map((platform) -> {
            if (platform.getPlatformType().equals(PlatformType.DOCKER)) {
                return AppPlatformDto.from(platform, dockerManager.getStatus(platform.getId()));
            }
            return AppPlatformDto.from(platform, sshManager.getStatus(platform.getId()));
        }).toList();
        return new PagedResponse<>(dtos, request.page(), request.pageSize(),
                (int) Math.ceil((double) total / request.pageSize()), total);
    }

    public AppPlatformDto get(UUID id) {
        logger.info("Requesting platform with ID {}", id);

        AppPlatform appPlatform = appPlatformRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "error.platform.notFound", "Platform not found"));
        boolean status = appPlatform.getPlatformType().equals(PlatformType.DOCKER)
                ? dockerManager.getStatus(id)
                : sshManager.getStatus(id);
        return AppPlatformDto.from(appPlatform, status);
    }

    @Transactional(rollbackFor = Exception.class)
    public void add(AddAppPlatformDto data) {
        if (appPlatformRepository.existsByName(data.name())) {
            throw new BusinessException(409, "error.platform.alreadyExists", "Platform already exists");
        }

        AppPlatform appPlatform = new AppPlatform();
        appPlatform.setName(data.name());
        appPlatform.setDescription(data.description());
        appPlatform.setPlatformType(data.platformType());

        if (data.platformType().equals(PlatformType.DOCKER)) {
            if (appPlatformRepository.existsByDockerHost(data.dockerHost())) {
                throw new BusinessException(409, "error.platform.dockerHost.used", "Docker host already used");
            }
            appPlatform.setDockerHost(data.dockerHost());
        } else if (data.platformType().equals(PlatformType.HOST)) {
            int port = data.sshPort() == null ? 22 : data.sshPort();

            if (appPlatformRepository.existsBySshHostAndSshPortAndSshUsername(data.sshHost(), port,
                    data.sshUsername())) {
                throw new BusinessException(409, "error.platform.sshHost.used", "SSH host already used");
            }

            appPlatform.setInitSystem(data.initSystem());
            appPlatform.setSshHost(data.sshHost());
            appPlatform.setSshPort(port);
            appPlatform.setSshUsername(data.sshUsername());
            appPlatform.setHostKeys(data.hostKeys());
        } else {
            throw new BusinessException(400, "error.platform.unknownType",
                    "Unknown platform type " + data.platformType().name());
        }

        if (data.credentialId() != null && !credentialRepository.existsById(data.credentialId())) {
            throw new BusinessException(404, "error.platform.credentialNotFound", "Credential not found");
        }
        appPlatform.setCredentialId(data.credentialId());
        appPlatform = appPlatformRepository.saveAndFlush(appPlatform);

        final AppPlatform copy = appPlatform;
        CompletableFuture.runAsync(() -> {
            if (data.platformType().equals(PlatformType.DOCKER)) {
                dockerManager.addPlatform(copy);
            } else {
                sshManager.addPlatform(copy);
            }
        }, AsyncTaskExecutor.getInstance());
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(UUID id, UpdateAppPlatformDto data) {
        AppPlatform platform = appPlatformRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "error.platform.notFound", "Platform not found"));

        if (!data.name().equals(platform.getName())) {
            if (appPlatformRepository.existsByName(data.name())) {
                throw new BusinessException(409, "error.platform.alreadyExists", "Platform already exists");
            }
            platform.setName(data.name());
        }
        platform.setDescription(data.description());

        boolean connUpdated = false;
        if (platform.getPlatformType().equals(PlatformType.DOCKER)) {
            if (!platform.getDockerHost().equals(data.dockerHost())) {
                if (appPlatformRepository.existsByDockerHost(data.dockerHost())) {
                    throw new BusinessException(409, "error.platform.dockerHost.used", "Docker host already used");
                }

                platform.setDockerHost(data.dockerHost());
                connUpdated = true;
            }
        } else {
            int port = data.sshPort() == null ? 22 : data.sshPort();

            if (platform.getSshPort() != port
                    || !Objects.equals(platform.getSshUsername(), data.sshUsername())
                    || !Objects.equals(platform.getSshHost(), data.sshHost())
                    || !Objects.equals(platform.getInitSystem(), data.initSystem())) {
                if (appPlatformRepository.existsBySshHostAndSshPortAndSshUsername(data.sshHost(), port,
                        data.sshUsername())) {
                    throw new BusinessException(409, "error.platform.sshHost.used", "SSH host already used");
                }
                connUpdated = true;
            }
            platform.setInitSystem(data.initSystem());
            platform.setSshHost(data.sshHost());
            platform.setSshPort(port);
            platform.setSshUsername(data.sshUsername());

            platform.setHostKeys(data.hostKeys());
        }

        if (platform.getCredentialId() == null || !Objects.equals(platform.getCredentialId(), data.credentialId())) {
            if (data.credentialId() != null) {
                boolean exists = credentialRepository.existsById(data.credentialId());
                if (!exists) {
                    throw new BusinessException(404, "error.platform.credentialNotFound", "Credential not found");
                }
            }
            platform.setCredentialId(data.credentialId());
            connUpdated = true;
        }

        platform = appPlatformRepository.saveAndFlush(platform);
        if (connUpdated) {
            final AppPlatform copy = platform;
            CompletableFuture.runAsync(() -> {
                if (copy.getPlatformType().equals(PlatformType.DOCKER)) {
                    dockerManager.removePlatform(id);
                    dockerManager.addPlatform(copy);
                } else {
                    sshManager.removePlatform(id);
                    sshManager.addPlatform(copy);
                }
            }, AsyncTaskExecutor.getInstance());
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void remove(UUID id) {
        AppPlatform platform = appPlatformRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "error.platform.notFound", "Platform not found"));
        if (platform.getPlatformType().equals(PlatformType.DOCKER)) {
            dockerManager.removePlatform(id);
        } else {
            sshManager.removePlatform(id);
        }
        appPlatformRepository.delete(platform);
    }
}
