package win.masteryyh.masteryyhsystem.service;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.base.utils.StaticArchiveValidator;
import win.masteryyh.masteryyhsystem.model.GatewayEntryPoint;
import win.masteryyh.masteryyhsystem.model.GatewayRoute;
import win.masteryyh.masteryyhsystem.model.StoredFile;
import win.masteryyh.masteryyhsystem.model.dto.GatewayRouteDto;
import win.masteryyh.masteryyhsystem.model.dto.GatewayRouteRequestDto;
import win.masteryyh.masteryyhsystem.model.dto.GatewayRouteType;
import win.masteryyh.masteryyhsystem.repository.GatewayEntryPointRepository;
import win.masteryyh.masteryyhsystem.repository.GatewayRouteRepository;

import java.net.URI;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class GatewayRouteService {
    private final GatewayEntryPointRepository entryPointRepository;

    private final GatewayRouteRepository repository;

    private final StoredFileService fileService;

    private final StaticArchiveValidator archiveValidator;

    private final GatewayService gatewayService;

    public GatewayRouteService(GatewayEntryPointRepository entryPointRepository,
                               GatewayRouteRepository repository,
                               StoredFileService fileService,
                               StaticArchiveValidator archiveValidator,
                               GatewayService gatewayService) {
        this.entryPointRepository = entryPointRepository;
        this.repository = repository;
        this.fileService = fileService;
        this.archiveValidator = archiveValidator;
        this.gatewayService = gatewayService;
    }

    @Transactional(readOnly = true)
    public List<GatewayRouteDto> list(UUID gatewayId, UUID entryPointId) {
        requireEntryPoint(gatewayId, entryPointId);
        return repository.findByEntryPointIdOrderByPriorityDescPathPrefixAsc(entryPointId)
                .stream().map(GatewayRouteDto::from).toList();
    }

    @Transactional(readOnly = true)
    public GatewayRouteDto get(UUID gatewayId, UUID entryPointId, UUID id) {
        return GatewayRouteDto.from(requireRoute(gatewayId, entryPointId, id));
    }

    @Transactional(rollbackFor = Exception.class)
    public void add(UUID gatewayId, UUID entryPointId, GatewayRouteRequestDto data) {
        requireEntryPoint(gatewayId, entryPointId);
        validate(data);
        if (repository.existsByEntryPointIdAndName(entryPointId, data.name())) {
            throw conflict();
        }
        GatewayRoute route = new GatewayRoute();
        route.setEntryPointId(entryPointId);
        apply(route, data);
        repository.saveAndFlush(route);
        gatewayService.markEntryPointPending(gatewayId, entryPointId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(UUID gatewayId, UUID entryPointId, UUID id, GatewayRouteRequestDto data) {
        GatewayRoute route = requireRoute(gatewayId, entryPointId, id);
        validate(data);
        if (!Objects.equals(route.getName(), data.name())
                && repository.existsByEntryPointIdAndName(entryPointId, data.name())) {
            throw conflict();
        }
        apply(route, data);
        repository.saveAndFlush(route);
        gatewayService.markEntryPointPending(gatewayId, entryPointId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void remove(UUID gatewayId, UUID entryPointId, UUID id) {
        GatewayRoute route = requireRoute(gatewayId, entryPointId, id);
        repository.delete(route);
        repository.flush();
        gatewayService.markEntryPointPending(gatewayId, entryPointId);
    }

    private void apply(GatewayRoute route, GatewayRouteRequestDto data) {
        route.setName(data.name());
        route.setPathPrefix(normalizePath(data.pathPrefix()));
        route.setRouteType(data.routeType());
        route.setPriority(data.priority());
        route.setProxyTarget(data.routeType() == GatewayRouteType.PROXY ? data.proxyTarget() : null);
        route.setStaticFileId(data.routeType() == GatewayRouteType.STATIC ? data.staticFileId() : null);
    }

    private void validate(GatewayRouteRequestDto data) {
        if (!data.pathPrefix().startsWith("/")) {
            throw new BusinessException(400, "error.gatewayRoute.path.invalid",
                    "Route path must start with /");
        }
        if (data.routeType() == GatewayRouteType.PROXY) {
            if (StringUtils.isBlank(data.proxyTarget())) {
                throw new BusinessException(400, "error.gatewayRoute.proxyTarget.empty",
                        "Proxy target cannot be empty");
            }
            URI uri;
            try {
                uri = URI.create(data.proxyTarget());
            } catch (IllegalArgumentException e) {
                throw new BusinessException(400, "error.gatewayRoute.proxyTarget.invalid",
                        "Proxy target is invalid");
            }
            if (!List.of("http", "https").contains(uri.getScheme()) || uri.getHost() == null) {
                throw new BusinessException(400, "error.gatewayRoute.proxyTarget.invalid",
                        "Proxy target must be an HTTP or HTTPS URL");
            }
        } else {
            if (data.staticFileId() == null) {
                throw new BusinessException(400, "error.gatewayRoute.staticFile.empty",
                        "Static route requires a ZIP file");
            }
            StoredFile file = fileService.find(data.staticFileId());
            archiveValidator.validate(file);
        }
    }

    private void requireEntryPoint(UUID gatewayId, UUID entryPointId) {
        GatewayEntryPoint entryPoint = entryPointRepository.findById(entryPointId)
                .orElseThrow(() -> new BusinessException(404, "error.gatewayEntryPoint.notFound",
                        "Gateway entry point not found"));
        if (!Objects.equals(entryPoint.getGatewayId(), gatewayId)) {
            throw new BusinessException(404, "error.gatewayEntryPoint.notFound", "Gateway entry point not found");
        }
    }

    private GatewayRoute requireRoute(UUID gatewayId, UUID entryPointId, UUID id) {
        requireEntryPoint(gatewayId, entryPointId);
        GatewayRoute route = repository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "error.gatewayRoute.notFound",
                        "Gateway route not found"));
        if (!Objects.equals(route.getEntryPointId(), entryPointId)) {
            throw new BusinessException(404, "error.gatewayRoute.notFound", "Gateway route not found");
        }
        return route;
    }

    private static String normalizePath(String path) {
        String trimmed = path.trim();
        return trimmed.length() > 1 && trimmed.endsWith("/")
                ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
    }

    private static BusinessException conflict() {
        return new BusinessException(409, "error.gatewayRoute.alreadyExists",
                "Route name already exists in this entry point");
    }
}
