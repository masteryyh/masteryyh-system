package win.masteryyh.masteryyhsystem.service;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.async.ResultCallback;
import com.github.dockerjava.api.command.CreateContainerResponse;
import com.github.dockerjava.api.command.PullImageResultCallback;
import com.github.dockerjava.api.command.WaitContainerResultCallback;
import com.github.dockerjava.api.model.ExposedPort;
import com.github.dockerjava.api.model.Frame;
import com.github.dockerjava.api.model.HostConfig;
import com.github.dockerjava.api.model.Ports;
import com.github.dockerjava.api.model.RestartPolicy;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
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
import win.masteryyh.masteryyhsystem.base.utils.ClasspathResources;
import win.masteryyh.masteryyhsystem.base.utils.NginxConfigCodec;
import win.masteryyh.masteryyhsystem.base.utils.NginxHelper;
import win.masteryyh.masteryyhsystem.base.websocket.EventBroadcaster;
import win.masteryyh.masteryyhsystem.model.AppPlatform;
import win.masteryyh.masteryyhsystem.model.GatewayConfig;
import win.masteryyh.masteryyhsystem.model.GatewayEntryPoint;
import win.masteryyh.masteryyhsystem.model.GatewayRoute;
import win.masteryyh.masteryyhsystem.model.dto.AddGatewayConfigDto;
import win.masteryyh.masteryyhsystem.model.dto.DeploymentBundle;
import win.masteryyh.masteryyhsystem.model.dto.GatewayConfigDto;
import win.masteryyh.masteryyhsystem.model.dto.GatewayStatus;
import win.masteryyh.masteryyhsystem.model.dto.InitSystem;
import win.masteryyh.masteryyhsystem.model.dto.PlatformType;
import win.masteryyh.masteryyhsystem.model.dto.UpdateGatewayConfigDto;
import win.masteryyh.masteryyhsystem.platform.CommandResult;
import win.masteryyh.masteryyhsystem.platform.DockerManager;
import win.masteryyh.masteryyhsystem.platform.SSHManager;
import win.masteryyh.masteryyhsystem.repository.AppPlatformRepository;
import win.masteryyh.masteryyhsystem.repository.GatewayConfigRepository;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class GatewayService {
    private static final Logger logger = LoggerFactory.getLogger(GatewayService.class);

    private static final SecureRandom RNG = new SecureRandom();

    private static final String SETUP_SCRIPT_REMOTE = "/tmp/gateway_setup.sh";
    private static final long INSTALL_TIMEOUT_SECONDS = 600L;
    private static final String NGINX_CONTAINER_PREFIX = "gateway-nginx-";
    private static final String CONF_D_DIR = "/etc/nginx/conf.d";
    private static final String SYSTEMD_SERVICE = "nginx";

    private final GatewayConfigRepository gatewayConfigRepository;

    private final AppPlatformRepository appPlatformRepository;

    private final DockerManager dockerManager;

    private final SSHManager sshManager;

    private final EventBroadcaster eventBroadcaster;

    private final RedissonClient redis;

    private final ClasspathResources resources;

    private final NginxHelper nginxHelper;

    private final NginxConfigCodec nginxConfigCodec;

    private final win.masteryyh.masteryyhsystem.repository.GatewayEntryPointRepository entryPointRepository;

    private final win.masteryyh.masteryyhsystem.repository.GatewayRouteRepository routeRepository;

    public GatewayService(GatewayConfigRepository gatewayConfigRepository,
            AppPlatformRepository appPlatformRepository,
            DockerManager dockerManager,
            SSHManager sshManager,
            EventBroadcaster eventBroadcaster,
            RedissonClient redisson,
            ClasspathResources resources,
            NginxHelper nginxHelper,
            NginxConfigCodec nginxConfigCodec,
            win.masteryyh.masteryyhsystem.repository.GatewayEntryPointRepository entryPointRepository,
            win.masteryyh.masteryyhsystem.repository.GatewayRouteRepository routeRepository) {
        this.gatewayConfigRepository = gatewayConfigRepository;
        this.appPlatformRepository = appPlatformRepository;
        this.dockerManager = dockerManager;
        this.sshManager = sshManager;
        this.eventBroadcaster = eventBroadcaster;
        this.redis = redisson;
        this.resources = resources;
        this.nginxHelper = nginxHelper;
        this.nginxConfigCodec = nginxConfigCodec;
        this.entryPointRepository = entryPointRepository;
        this.routeRepository = routeRepository;
    }

    @Transactional(readOnly = true)
    public PagedResponse<GatewayConfigDto> page(PageDataRequest request) {
        logger.info("Requesting gateway page {} size {}", request.page(), request.pageSize());
        Page<GatewayConfig> p = gatewayConfigRepository.findAll(PageRequest.of(request.page() - 1,
                request.pageSize(), Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("createdAt"))));
        List<GatewayConfigDto> dtos = p.getContent().stream().map(GatewayConfigDto::from).toList();
        return new PagedResponse<>(dtos, request.page(), request.pageSize(),
                (int) Math.ceil((double) p.getTotalElements() / request.pageSize()), p.getTotalElements());
    }

    @Transactional(readOnly = true)
    public GatewayConfigDto get(UUID id) {
        GatewayConfig cfg = gatewayConfigRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "error.gateway.notFound", "Gateway not found"));
        return GatewayConfigDto.from(cfg);
    }

    @Transactional(rollbackFor = Exception.class)
    public void requestRedeploy(UUID gatewayId) {
        GatewayConfig cfg = gatewayConfigRepository.findById(gatewayId)
                .orElseThrow(() -> new BusinessException(404, "error.gateway.notFound", "Gateway not found"));
        boolean isUpdate = hasRuntime(cfg);
        refreshGatewayCandidateConfigs(gatewayId);
        cfg.setStatus(GatewayStatus.STARTING);
        gatewayConfigRepository.saveAndFlush(cfg);

        AsyncTaskExecutor.afterCommit(() -> {
            try {
                provisionGateway(gatewayId, isUpdate);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                logger.warn("Gateway redeploy interrupted for {}: ", gatewayId, e);
            }
        });
    }

    @Transactional(rollbackFor = Exception.class)
    public void add(AddGatewayConfigDto data) {
        nginxConfigCodec.requireSafeName(data.name(), "gateway");
        nginxConfigCodec.validateMainConfig(data.configContent());
        if (gatewayConfigRepository.existsByName(data.name())) {
            throw new BusinessException(409, "error.gateway.alreadyExists", "Gateway already exists");
        }
        AppPlatform platform = appPlatformRepository.findById(data.platformId())
                .orElseThrow(() -> new BusinessException(404, "error.platform.notFound", "Platform not found"));
        data.validate(platform.getPlatformType());

        GatewayConfig cfg = new GatewayConfig();
        cfg.setName(data.name());
        cfg.setDescription(data.description());
        cfg.setPlatformId(data.platformId());
        cfg.setAppVersion(data.appVersion());
        cfg.setContainerImage(data.containerImage());
        cfg.setContainerConfigPath(data.containerConfigPath());
        cfg.setConfigContent(data.configContent());
        cfg.setStatus(GatewayStatus.STOPPED);
        cfg.setPendingChanges(true);
        gatewayConfigRepository.saveAndFlush(cfg);
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(UUID id, UpdateGatewayConfigDto data) {
        nginxConfigCodec.requireSafeName(data.name(), "gateway");
        nginxConfigCodec.validateMainConfig(data.configContent());
        GatewayConfig cfg = gatewayConfigRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "error.gateway.notFound", "Gateway not found"));
        if (!Objects.equals(cfg.getName(), data.name()) && gatewayConfigRepository.existsByName(data.name())) {
            throw new BusinessException(409, "error.gateway.alreadyExists", "Gateway already exists");
        }
        AppPlatform platform = appPlatformRepository.findById(cfg.getPlatformId())
                .orElseThrow(() -> new BusinessException(404, "error.platform.notFound", "Platform not found"));
        data.validate(platform.getPlatformType());

        cfg.setName(data.name());
        cfg.setDescription(data.description());
        cfg.setAppVersion(data.appVersion());
        cfg.setContainerImage(data.containerImage());
        cfg.setContainerConfigPath(data.containerConfigPath());
        cfg.setConfigContent(data.configContent());
        cfg.setPendingChanges(true);
        gatewayConfigRepository.saveAndFlush(cfg);
    }

    public void markGatewayPending(UUID gatewayId) {
        gatewayConfigRepository.findById(gatewayId).ifPresent(cfg -> {
            cfg.setPendingChanges(true);
            gatewayConfigRepository.save(cfg);
        });
    }

    public void markEntryPointPending(UUID gatewayId, UUID entryPointId) {
        refreshEntryPointCandidateConfig(entryPointId);
        markGatewayPending(gatewayId);
    }

    public void refreshEntryPointCandidateConfig(UUID entryPointId) {
        entryPointRepository.findById(entryPointId).ifPresent(entryPoint -> {
            List<GatewayRoute> routes =
                    routeRepository.findByEntryPointIdOrderByPriorityDescPathPrefixAsc(entryPointId);
            entryPoint.setCurrentConfigContent(nginxConfigCodec.write(entryPoint, routes));
            entryPointRepository.save(entryPoint);
        });
    }

    public void refreshGatewayCandidateConfigs(UUID gatewayId) {
        entryPointRepository.findByGatewayIdOrderByListenPortAscNameAsc(gatewayId)
                .forEach(entryPoint -> refreshEntryPointCandidateConfig(entryPoint.getId()));
    }

    @Transactional(rollbackFor = Exception.class)
    public void remove(UUID id) {
        GatewayConfig cfg = gatewayConfigRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "error.gateway.notFound", "Gateway not found"));
        cfg.setStatus(GatewayStatus.STOPPING);
        gatewayConfigRepository.saveAndFlush(cfg);

        AsyncTaskExecutor.afterCommit(() -> {
            try {
                deleteGateway(id);
            } catch (Exception e) {
                logger.warn("Error occurred when deleting gateway: ", e);
            }
        });
    }

    private void deleteGateway(UUID gatewayId) {
        String channel = "gateway:" + gatewayId;
        RLock lock = redis.getLock("lock:gateway:" + gatewayId.toString());

        try {
            if (!lock.tryLock(30, TimeUnit.SECONDS)) {
                logger.warn("Failed to acquire lock for gateway deletion, maybe some other thread is performing operation, gateway ID: {}", gatewayId);
                return;
            }

            GatewayConfig cfg = gatewayConfigRepository.findById(gatewayId).orElse(null);
            if (cfg == null) {
                logger.warn("Gateway {} vanished before deletion", gatewayId);
                return;
            }
            eventBroadcaster.publish(channel, "progress",
                    Map.of("step", "teardown", "message", "Tearing down gateway runtime"));
            try {
                teardown(cfg);
            } catch (Exception e) {
                logger.warn("Teardown failed for gateway {} ({}): {}", gatewayId, cfg.getName(), e.getMessage(), e);
                eventBroadcaster.publish(channel, "progress",
                        Map.of("step", "teardown", "message", "Teardown failed: " + e.getMessage()));
            }

            eventBroadcaster.publish(channel, "progress",
                    Map.of("step", "delete", "message", "Removing gateway record"));
            var entryPoints = entryPointRepository.findByGatewayIdOrderByListenPortAscNameAsc(gatewayId);
            entryPoints.forEach(entryPoint ->
                    routeRepository.deleteAll(routeRepository.findByEntryPointIdOrderByPriorityDescPathPrefixAsc(entryPoint.getId())));
            entryPointRepository.deleteAll(entryPoints);
            gatewayConfigRepository.delete(cfg);

            eventBroadcaster.publish(channel, "done", Map.of("status", "DELETED"));
            logger.info("Gateway {} deleted", gatewayId);
        } catch (Exception e) {
            logger.warn("Deletion failed for gateway {}: {}", gatewayId, e.getMessage(), e);
            eventBroadcaster.publish(channel, "failed", Map.of("message", e.getMessage()));
        } finally {
            if (lock.isLocked() && lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    private void provisionGateway(UUID gatewayId, boolean isUpdate) throws InterruptedException {
        String channel = "gateway:" + gatewayId;
        RLock lock = redis.getLock("lock:gateway:" + gatewayId.toString());

        try {
            if (!lock.tryLock(30, TimeUnit.SECONDS)) {
                logger.warn("Failed to acquire lock for gateway provision, maybe some other thread is performing operation, gateway ID: {}", gatewayId);
                return;
            }

            Optional<GatewayConfig> cfgOptional = gatewayConfigRepository.findById(gatewayId);
            if (cfgOptional.isEmpty()) {
                logger.warn("Gateway {} vanished before provisioning", gatewayId);
                return;
            }
            GatewayConfig cfg = cfgOptional.get();

            Optional<AppPlatform> platformOptional = appPlatformRepository.findById(cfg.getPlatformId());
            if (platformOptional.isEmpty()) {
                markProvisionFailed(gatewayId, isUpdate);
                eventBroadcaster.publish(channel, "failed", Map.of("message", "Linked platform no longer exists"));
                return;
            }
            AppPlatform platform = platformOptional.get();

            if (!isPlatformReady(platform)) {
                markProvisionFailed(gatewayId, isUpdate);
                eventBroadcaster.publish(channel, "failed",
                        Map.of("message", "Platform is not connected/healthy"));
                return;
            }

            eventBroadcaster.publish(channel, "progress", Map.of(
                    "step", "start", "update", isUpdate,
                    "message", isUpdate ? "Re-provisioning gateway" : "Provisioning gateway"));

            if (platform.getPlatformType() == PlatformType.DOCKER) {
                provisionDocker(cfg, isUpdate, channel);
            } else {
                provisionHost(cfg, isUpdate, channel);
            }

            gatewayConfigRepository.findById(gatewayId).ifPresent((fresh) -> {
                fresh.setStatus(GatewayStatus.HEALTHY);
                fresh.setPendingChanges(false);
                gatewayConfigRepository.save(fresh);
                markEntryPointsApplied(gatewayId);

                if (platform.getPlatformType().equals(PlatformType.DOCKER)) {
                    eventBroadcaster.publish(channel, "done", Map.of(
                            "status", GatewayStatus.HEALTHY.name(),
                            "containerId", fresh.getContainerId(),
                            "containerName", fresh.getContainerName()));
                } else {
                    eventBroadcaster.publish(channel, "done", Map.of(
                            "status", GatewayStatus.HEALTHY.name(),
                            "systemdServiceName", fresh.getSystemdServiceName()));
                }
            });
        } catch (Exception e) {
            logger.warn("Provisioning failed for gateway {}: ", gatewayId, e);
            markProvisionFailed(gatewayId, isUpdate);
            eventBroadcaster.publish(channel, "failed", Map.of("message", e.getMessage()));
        } finally {
            if (lock.isLocked() && lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    private boolean isPlatformReady(AppPlatform platform) {
        return platform.getPlatformType() == PlatformType.DOCKER
                ? dockerManager.getStatus(platform.getId())
                : sshManager.getStatus(platform.getId());
    }

    private void markProvisionFailed(UUID gatewayId, boolean hadRuntime) {
        try {
            gatewayConfigRepository.findById(gatewayId).ifPresent((cfg) -> {
                cfg.setStatus(hadRuntime ? GatewayStatus.HEALTHY : GatewayStatus.UNHEALTHY);
                cfg.setPendingChanges(true);
                gatewayConfigRepository.save(cfg);
            });
        } catch (Exception e) {
            logger.warn("Failed to mark gateway {} after provision failure: ", gatewayId, e);
        }
    }

    private void markEntryPointsApplied(UUID gatewayId) {
        List<GatewayEntryPoint> entryPoints =
                entryPointRepository.findByGatewayIdOrderByListenPortAscNameAsc(gatewayId);
        entryPoints.forEach(entryPoint -> {
            entryPoint.setLastConfigContent(entryPoint.getCurrentConfigContent());
            entryPointRepository.save(entryPoint);
        });
    }

    private static boolean hasRuntime(GatewayConfig cfg) {
        return cfg.getContainerId() != null || cfg.getSystemdServiceName() != null;
    }

    private void provisionDocker(GatewayConfig cfg, boolean isUpdate, String channel) throws Exception {
        DockerClient client = dockerManager.getClient(cfg.getPlatformId())
                .orElseThrow(() -> new BusinessException(503, "error.platform.notReady",
                        "Docker platform not ready"));

        eventBroadcaster.publish(channel, "progress",
                Map.of("step", "pull", "message", "Pulling image " + cfg.getContainerImage()));
        client.pullImageCmd(cfg.getContainerImage())
                .exec(new PullImageResultCallback())
                .awaitCompletion();

        DeploymentBundle bundle = nginxHelper.build(cfg);
        byte[] archive = nginxHelper.dockerTar(bundle);

        eventBroadcaster.publish(channel, "progress",
                Map.of("step", "config", "message", "Building candidate nginx configuration"));
        validateDockerConfiguration(client, cfg, archive, channel);

        String containerName = containerName(cfg.getName());
        Ports portBindings = new Ports();
        List<ExposedPort> exposedPorts = bundle.listenPorts().stream().map(ExposedPort::tcp).toList();
        exposedPorts.forEach(port -> portBindings.bind(port, Ports.Binding.bindPort(port.getPort())));
        eventBroadcaster.publish(channel, "progress",
                Map.of("step", "create", "message", "Preparing container " + containerName));
        HostConfig hostConfig = HostConfig.newHostConfig()
                .withPortBindings(portBindings)
                .withRestartPolicy(RestartPolicy.alwaysRestart());
        CreateContainerResponse container = client.createContainerCmd(cfg.getContainerImage())
                .withName(containerName)
                .withExposedPorts(exposedPorts)
                .withEntrypoint("/bin/sh")
                .withCmd("-c", "rm -f /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'")
                .withHostConfig(hostConfig)
                .exec();
        try {
            client.copyArchiveToContainerCmd(container.getId())
                    .withRemotePath("/")
                    .withTarInputStream(new ByteArrayInputStream(archive))
                    .exec();

            String oldContainerId = cfg.getContainerId();
            if (isUpdate) {
                eventBroadcaster.publish(channel, "progress",
                        Map.of("step", "teardown", "message", "Stopping previous container"));
                stopContainer(client, oldContainerId);
            }
            try {
                client.startContainerCmd(container.getId()).exec();
            } catch (Exception startError) {
                if (isUpdate && oldContainerId != null) {
                    try {
                        client.startContainerCmd(oldContainerId).exec();
                    } catch (Exception rollbackError) {
                        startError.addSuppressed(rollbackError);
                    }
                }
                throw startError;
            }
            if (isUpdate) {
                removeContainer(client, oldContainerId);
            }
        } catch (Exception e) {
            removeContainer(client, container.getId());
            throw e;
        }

        cfg.setContainerId(container.getId());
        cfg.setContainerName(containerName);
        gatewayConfigRepository.save(cfg);

        eventBroadcaster.publish(channel, "progress",
                Map.of("step", "started", "message", "Container started"));
        logger.info("Docker gateway {} started as container {}", cfg.getId(), containerName);
    }

    private void validateDockerConfiguration(DockerClient client, GatewayConfig cfg,
                                             byte[] archive, String channel) throws Exception {
        String validationName = "gw-nginx-test-" + randomSuffix();
        CreateContainerResponse validation = client.createContainerCmd(cfg.getContainerImage())
                .withName(validationName)
                .withEntrypoint("/bin/sh")
                .withCmd("-c", "rm -f /etc/nginx/conf.d/default.conf && nginx -t -c /etc/nginx/nginx.conf")
                .exec();
        try {
            client.copyArchiveToContainerCmd(validation.getId())
                    .withRemotePath("/")
                    .withTarInputStream(new ByteArrayInputStream(archive))
                    .exec();
            eventBroadcaster.publish(channel, "progress",
                    Map.of("step", "validate", "message", "Running nginx -t in candidate container"));
            client.startContainerCmd(validation.getId()).exec();
            Integer exit = client.waitContainerCmd(validation.getId())
                    .exec(new WaitContainerResultCallback())
                    .awaitStatusCode();
            if (exit == null || exit != 0) {
                String logs = readContainerLogs(client, validation.getId());
                throw new BusinessException(500, "error.gateway.configWriteFailed",
                        "nginx -t failed (exit " + exit + "): " + logs);
            }
        } finally {
            try {
                client.removeContainerCmd(validation.getId()).withForce(true).withRemoveVolumes(true).exec();
            } catch (Exception ignored) {
            }
        }
    }

    private String readContainerLogs(DockerClient client, String containerId) throws InterruptedException {
        StringBuilder output = new StringBuilder();
        try (ResultCallback.Adapter<Frame> callback = new ResultCallback.Adapter<>() {
                    @Override
                    public void onNext(Frame frame) {
                        output.append(new String(frame.getPayload(), StandardCharsets.UTF_8));
                    }
                }) {
            client.logContainerCmd(containerId)
                    .withStdOut(true)
                    .withStdErr(true)
                    .exec(callback)
                    .awaitCompletion();
        } catch (java.io.IOException e) {
            logger.warn("Failed to close log callback for container {}: {}", containerId, e.getMessage());
        }
        return output.toString().trim();
    }

    private void provisionHost(GatewayConfig cfg, boolean isUpdate, String channel) throws Exception {
        UUID platformId = cfg.getPlatformId();
        String confName = confName(cfg.getName(), cfg.getId());
        String remoteArchivePath = "/tmp/masteryyh-gw-" + shortId(cfg.getId()) + ".tar.gz";

        eventBroadcaster.publish(channel, "progress",
                Map.of("step", "upload-script", "message", "Uploading gateway_setup.sh"));
        sshManager.uploadBytes(platformId, resources.getGatewayScript(), SETUP_SCRIPT_REMOTE);
        sshManager.runCommand(platformId, "chmod +x " + SETUP_SCRIPT_REMOTE, 10);

        String action = isUpdate ? "update" : "install";
        String scriptCmd = "bash " + SETUP_SCRIPT_REMOTE + ' ' + action +
                " --version " + shellQuote(cfg.getAppVersion()) +
                " --name " + shellQuote(confName) +
                " --defer-start";

        eventBroadcaster.publish(channel, "progress",
                Map.of("step", "install",
                        "message", (isUpdate ? "Updating" : "Installing") + " nginx " + cfg.getAppVersion()));
        CommandResult result = sshManager.runCommand(platformId, scriptCmd,
                INSTALL_TIMEOUT_SECONDS);

        if (result.exitCode() != 0) {
            throw new BusinessException(500, "error.gateway.installFailed",
                    "gateway_setup.sh " + action + " failed (exit " + result.exitCode() + "): " + result.stderr());
        }

        DeploymentBundle bundle = nginxHelper.build(cfg);
        eventBroadcaster.publish(channel, "progress",
                Map.of("step", "upload-config", "message", "Uploading candidate nginx deployment bundle"));
        sshManager.uploadBytes(platformId, nginxHelper.hostTar(bundle), remoteArchivePath);
        deployHostBundle(cfg, bundle, remoteArchivePath, channel);

        cfg.setSystemdServiceName(SYSTEMD_SERVICE);
        cfg.setLocalConfigPath(CONF_D_DIR);
        gatewayConfigRepository.save(cfg);

        eventBroadcaster.publish(channel, "progress",
                Map.of("step", "started", "message", "nginx " + cfg.getAppVersion() + " running on host"));
        logger.info("Host gateway {} provisioned (nginx {})", cfg.getId(), cfg.getAppVersion());
    }

    private void deployHostBundle(GatewayConfig cfg,
                                  DeploymentBundle bundle,
                                  String remoteArchivePath,
                                  String channel) {
        String gatewayPrefix = cfg.getName() + "-";
        String gatewayId = cfg.getId().toString();
        String stage = "/tmp/masteryyh-gateway-stage-" + shortId(cfg.getId());
        String backup = "/tmp/masteryyh-gateway-backup-" + shortId(cfg.getId());
        String reload = "(systemctl enable nginx >/dev/null 2>&1 && systemctl restart nginx)"
                + " || (rc-update add nginx default >/dev/null 2>&1 && rc-service nginx restart)";
        String customMain = bundle.customMainConfig() ? "1" : "0";
        String command = """
                set -eu
                stage=%s
                backup=%s
                archive=%s
                prefix=%s
                gateway_id=%s
                rm -rf "$stage" "$backup"
                mkdir -p "$stage/conf.d" "$stage/certs" "$stage/static" "$backup/conf.d" "$backup/certs" "$backup/static"
                tar -xzf "$archive" -C "$stage"
                cp -a /etc/nginx/nginx.conf "$backup/nginx.conf"
                cp -a /etc/nginx/conf.d/${prefix}*.conf "$backup/conf.d/" 2>/dev/null || true
                [ -d "/etc/nginx/masteryyh/certs/$gateway_id" ] && cp -a "/etc/nginx/masteryyh/certs/$gateway_id" "$backup/certs/" || true
                [ -d "/var/www/masteryyh/$gateway_id" ] && cp -a "/var/www/masteryyh/$gateway_id" "$backup/static/" || true
                rollback() {
                    cp -a "$backup/nginx.conf" /etc/nginx/nginx.conf
                    rm -f /etc/nginx/conf.d/${prefix}*.conf
                    cp -a "$backup/conf.d/." /etc/nginx/conf.d/ 2>/dev/null || true
                    rm -rf "/etc/nginx/masteryyh/certs/$gateway_id"
                    [ -d "$backup/certs/$gateway_id" ] && mkdir -p /etc/nginx/masteryyh/certs && cp -a "$backup/certs/$gateway_id" /etc/nginx/masteryyh/certs/ || true
                    rm -rf "/var/www/masteryyh/$gateway_id"
                    [ -d "$backup/static/$gateway_id" ] && mkdir -p /var/www/masteryyh && cp -a "$backup/static/$gateway_id" /var/www/masteryyh/ || true
                }
                trap rollback ERR
                mkdir -p /etc/nginx/conf.d /etc/nginx/masteryyh/certs /var/www/masteryyh
                rm -f /etc/nginx/conf.d/${prefix}*.conf
                cp -a "$stage/conf.d/." /etc/nginx/conf.d/ 2>/dev/null || true
                rm -rf "/etc/nginx/masteryyh/certs/$gateway_id"
                [ -d "$stage/certs/$gateway_id" ] && cp -a "$stage/certs/$gateway_id" /etc/nginx/masteryyh/certs/ || true
                rm -rf "/var/www/masteryyh/$gateway_id"
                [ -d "$stage/static/$gateway_id" ] && cp -a "$stage/static/$gateway_id" /var/www/masteryyh/ || true
                if [ %s = 1 ]; then
                    [ -f /etc/nginx/nginx.conf.masteryyh-default ] || cp -a /etc/nginx/nginx.conf /etc/nginx/nginx.conf.masteryyh-default
                    cp -a "$stage/main/nginx.conf" /etc/nginx/nginx.conf
                elif [ -f /etc/nginx/nginx.conf.masteryyh-default ]; then
                    cp -a /etc/nginx/nginx.conf.masteryyh-default /etc/nginx/nginx.conf
                fi
                chmod 600 /etc/nginx/masteryyh/certs/*/*/private-key.pem 2>/dev/null || true
                nginx -t -c /etc/nginx/nginx.conf
                %s
                trap - ERR
                rm -rf "$stage" "$backup" "$archive"
                """.formatted(shellQuote(stage), shellQuote(backup), shellQuote(remoteArchivePath),
                shellQuote(gatewayPrefix), shellQuote(gatewayId), customMain, reload);

        eventBroadcaster.publish(channel, "progress",
                Map.of("step", "validate", "message", "Running nginx -t before applying host configuration"));
        CommandResult deploy = sshManager.runCommand(cfg.getPlatformId(), command, 180);
        if (deploy.exitCode() != 0) {
            throw new BusinessException(500, "error.gateway.configWriteFailed",
                    "nginx -t or reload failed: " + deploy.stderr());
        }
    }

    private void teardown(GatewayConfig cfg) throws Exception {
        Optional<AppPlatform> platformOptional = appPlatformRepository.findById(cfg.getPlatformId());
        if (platformOptional.isEmpty()) {
            logger.warn("Platform missing during teardown of gateway {}", cfg.getId());
            return;
        }
        AppPlatform platform = platformOptional.get();

        if (platform.getPlatformType().equals(PlatformType.DOCKER)) {
            dockerManager.getClient(cfg.getPlatformId()).ifPresent((client) -> {
                removeContainer(client, cfg.getContainerId());
            });
        } else {
            teardownHost(cfg, platform);
        }
    }

    private void teardownHost(GatewayConfig cfg, AppPlatform platform) {
        if (!sshManager.getStatus(platform.getId())) {
            logger.warn("Host not ready during teardown of gateway {}; skipping conf cleanup", cfg.getId());
            return;
        }

        String confPattern = Path.of(CONF_D_DIR, cfg.getName() + "-*.conf").toString();
        String reload = platform.getInitSystem().equals(InitSystem.OPENRC)
                ? "rc-service nginx reload"
                : "systemctl reload nginx";
        String cmd = "rm -f " + confPattern
                + " && rm -rf " + shellQuote("/var/www/masteryyh/" + cfg.getId())
                + " && nginx -t 2>/dev/null && (" + reload
                + " || systemctl restart nginx 2>/dev/null || rc-service nginx restart 2>/dev/null || true)";
        try {
            CommandResult r = sshManager.runCommand(platform.getId(), cmd, 60);
            if (r.exitCode() != 0) {
                logger.warn("Host teardown returned non-zero for gateway {}: {}", cfg.getId(), r.stderr());
            }
        } catch (Exception e) {
            logger.warn("Host teardown failed for gateway {}: {}", cfg.getId(), e.getMessage());
        }
    }

    private void removeContainer(DockerClient client, String containerId) {
        if (containerId == null || containerId.isBlank()) {
            return;
        }
        try {
            client.stopContainerCmd(containerId).withTimeout(10).exec();
        } catch (Exception ignored) {
        }
        try {
            client.removeContainerCmd(containerId).withForce(true).withRemoveVolumes(true).exec();
        } catch (Exception e) {
            logger.debug("removeContainer {} failed: {}", containerId, e.getMessage());
        }
    }

    private void stopContainer(DockerClient client, String containerId) {
        if (containerId == null || containerId.isBlank()) {
            return;
        }
        try {
            client.stopContainerCmd(containerId).withTimeout(10).exec();
        } catch (Exception e) {
            logger.debug("stopContainer {} failed: {}", containerId, e.getMessage());
        }
    }

    private static String containerName(String gatewayName) {
        return NGINX_CONTAINER_PREFIX + sanitizeName(gatewayName) + "-" + randomSuffix();
    }

    private static String confName(String gatewayName, UUID gatewayId) {
        return sanitizeName(gatewayName) + "-" + shortId(gatewayId);
    }

    private static String sanitizeName(String raw) {
        String s = raw == null ? "gateway" : raw.toLowerCase().trim();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length() && sb.length() < 40; i++) {
            char c = s.charAt(i);
            if (Character.isLetterOrDigit(c) || c == '-' || c == '_' || c == '.') {
                sb.append(c);
            } else {
                sb.append('-');
            }
        }
        if (sb.isEmpty() || !Character.isLetterOrDigit(sb.charAt(0))) {
            sb.insert(0, 'g');
        }
        return sb.toString();
    }

    private static String randomSuffix() {
        return String.format("%06d", RNG.nextInt(1_000_000));
    }

    private static String shortId(UUID id) {
        return id.toString().replace("-", "").substring(0, 8);
    }

    private static String shellQuote(String value) {
        if (value == null) {
            return "''";
        }
        return "'" + value.replace("'", "'\\''") + "'";
    }
}
