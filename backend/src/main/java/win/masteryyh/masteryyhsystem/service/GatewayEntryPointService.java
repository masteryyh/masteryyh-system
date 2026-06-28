package win.masteryyh.masteryyhsystem.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.model.Credential;
import win.masteryyh.masteryyhsystem.model.GatewayEntryPoint;
import win.masteryyh.masteryyhsystem.model.dto.CredentialType;
import win.masteryyh.masteryyhsystem.model.dto.GatewayEntryPointDto;
import win.masteryyh.masteryyhsystem.model.dto.GatewayEntryPointRequest;
import win.masteryyh.masteryyhsystem.repository.CredentialRepository;
import win.masteryyh.masteryyhsystem.repository.GatewayConfigRepository;
import win.masteryyh.masteryyhsystem.repository.GatewayEntryPointRepository;
import win.masteryyh.masteryyhsystem.repository.GatewayRouteRepository;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class GatewayEntryPointService {
    private static final Pattern SAFE_NAME = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,63}");
    private static final Pattern DOMAIN = Pattern.compile("(?:\\*\\.)?[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?");

    private final GatewayConfigRepository gatewayRepository;

    private final GatewayEntryPointRepository repository;

    private final GatewayRouteRepository routeRepository;

    private final CredentialRepository credentialRepository;

    private final GatewayService gatewayService;

    public GatewayEntryPointService(GatewayConfigRepository gatewayRepository,
                                    GatewayEntryPointRepository repository,
                                    GatewayRouteRepository routeRepository,
                                    CredentialRepository credentialRepository,
                                    GatewayService gatewayService) {
        this.gatewayRepository = gatewayRepository;
        this.repository = repository;
        this.routeRepository = routeRepository;
        this.credentialRepository = credentialRepository;
        this.gatewayService = gatewayService;
    }

    @Transactional(readOnly = true)
    public List<GatewayEntryPointDto> list(UUID gatewayId) {
        requireGateway(gatewayId);
        return repository.findByGatewayIdOrderByListenPortAscNameAsc(gatewayId)
                .stream().map(GatewayEntryPointDto::from).toList();
    }

    @Transactional(readOnly = true)
    public GatewayEntryPointDto get(UUID gatewayId, UUID id) {
        return GatewayEntryPointDto.from(find(gatewayId, id));
    }

    @Transactional(rollbackFor = Exception.class)
    public void add(UUID gatewayId, GatewayEntryPointRequest data) {
        requireGateway(gatewayId);
        validate(data);
        if (repository.existsByGatewayIdAndName(gatewayId, data.name())) {
            throw conflict("Entry point name already exists");
        }
        if (repository.existsByGatewayIdAndListenPort(gatewayId, data.listenPort())) {
            throw conflict("Entry point listen port already exists");
        }
        GatewayEntryPoint entryPoint = new GatewayEntryPoint();
        entryPoint.setGatewayId(gatewayId);
        apply(entryPoint, data);
        repository.saveAndFlush(entryPoint);
        gatewayService.markEntryPointPending(gatewayId, entryPoint.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(UUID gatewayId, UUID id, GatewayEntryPointRequest data) {
        GatewayEntryPoint entryPoint = find(gatewayId, id);
        validate(data);
        if (!Objects.equals(entryPoint.getName(), data.name())
                && repository.existsByGatewayIdAndName(gatewayId, data.name())) {
            throw conflict("Entry point name already exists");
        }
        if (!Objects.equals(entryPoint.getListenPort(), data.listenPort())
                && repository.existsByGatewayIdAndListenPort(gatewayId, data.listenPort())) {
            throw conflict("Entry point listen port already exists");
        }
        apply(entryPoint, data);
        repository.saveAndFlush(entryPoint);
        gatewayService.markEntryPointPending(gatewayId, entryPoint.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public void remove(UUID gatewayId, UUID id) {
        GatewayEntryPoint entryPoint = find(gatewayId, id);
        routeRepository.deleteAll(routeRepository.findByEntryPointIdOrderByPriorityDescPathPrefixAsc(id));
        repository.delete(entryPoint);
        repository.flush();
        gatewayService.markGatewayPending(gatewayId);
    }

    private void apply(GatewayEntryPoint entryPoint, GatewayEntryPointRequest data) {
        entryPoint.setName(data.name());
        entryPoint.setListenPort(data.listenPort());
        entryPoint.setDomainNames(data.domainNames().stream().map(String::trim).distinct().toList());
        entryPoint.setCertificateCredentialId(data.certificateCredentialId());
    }

    private void validate(GatewayEntryPointRequest data) {
        if (!SAFE_NAME.matcher(data.name()).matches()) {
            throw new BusinessException(400, "error.gatewayEntryPoint.name.invalid",
                    "Entry point name may only contain letters, digits, dots, underscores and hyphens");
        }
        if (data.domainNames().stream().map(String::trim).anyMatch(domain -> !DOMAIN.matcher(domain).matches())) {
            throw new BusinessException(400, "error.gatewayEntryPoint.domain.invalid", "Invalid domain name");
        }
        if (data.certificateCredentialId() != null) {
            Credential credential = credentialRepository.findById(data.certificateCredentialId())
                    .orElseThrow(() -> new BusinessException(404, "error.credential.notFound", "Credential not found"));
            if (credential.getCredentialType() != CredentialType.X509_CERTIFICATE) {
                throw new BusinessException(400, "error.gatewayEntryPoint.certificate.invalid",
                        "HTTPS certificate must reference an X.509 credential");
            }
        }
    }

    private void requireGateway(UUID gatewayId) {
        if (!gatewayRepository.existsById(gatewayId)) {
            throw new BusinessException(404, "error.gateway.notFound", "Gateway not found");
        }
    }

    private GatewayEntryPoint find(UUID gatewayId, UUID id) {
        GatewayEntryPoint entryPoint = repository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "error.gatewayEntryPoint.notFound",
                        "Gateway entry point not found"));
        if (!Objects.equals(entryPoint.getGatewayId(), gatewayId)) {
            throw new BusinessException(404, "error.gatewayEntryPoint.notFound", "Gateway entry point not found");
        }
        return entryPoint;
    }

    private static BusinessException conflict(String message) {
        return new BusinessException(409, "error.gatewayEntryPoint.alreadyExists", message);
    }
}
