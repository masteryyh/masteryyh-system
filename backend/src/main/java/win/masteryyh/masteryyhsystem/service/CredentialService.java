package win.masteryyh.masteryyhsystem.service;

import org.bouncycastle.crypto.params.AsymmetricKeyParameter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.base.page.PageDataRequest;
import win.masteryyh.masteryyhsystem.base.page.PagedResponse;
import win.masteryyh.masteryyhsystem.base.utils.crypto.CryptoUtils;
import win.masteryyh.masteryyhsystem.model.Credential;
import win.masteryyh.masteryyhsystem.model.dto.AddCredentialDto;
import win.masteryyh.masteryyhsystem.model.dto.CredentialDto;
import win.masteryyh.masteryyhsystem.model.dto.CredentialStatus;
import win.masteryyh.masteryyhsystem.model.dto.CredentialType;
import win.masteryyh.masteryyhsystem.model.dto.UpdateCredentialDto;
import win.masteryyh.masteryyhsystem.repository.AppPlatformRepository;
import win.masteryyh.masteryyhsystem.repository.CredentialRepository;

import java.io.IOException;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class CredentialService {
    private static final Logger logger = LoggerFactory.getLogger(CredentialService.class);

    private final CredentialRepository credentialRepository;

    private final AppPlatformRepository appPlatformRepository;

    /** 距离过期不足该天数时进入 EXPIRING_SOON 状态，默认 30 天，可通过 application.yaml 覆盖。 */
    private final int expiringSoonDays;

    public CredentialService(CredentialRepository credentialRepository,
                             AppPlatformRepository appPlatformRepository,
                             @Value("${system.credential.expiring-soon-days:30}") int expiringSoonDays) {
        this.credentialRepository = credentialRepository;
        this.appPlatformRepository = appPlatformRepository;
        this.expiringSoonDays = expiringSoonDays;
    }

    @Transactional(rollbackFor = Exception.class)
    public PagedResponse<CredentialDto> page(PageDataRequest request) {
        logger.info("Requesting credential page {} size {}", request.page(), request.pageSize());

        Page<Credential> credentialPage = credentialRepository.findAll(PageRequest.of(request.page() - 1, request.pageSize(),
                Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("createdAt"))));
        long total = credentialPage.getTotalElements();
        List<Credential> credentials = credentialPage.getContent();
        logger.info("Found {} credentials for page {}, total {}",  credentials.size(), request.page(), total);

        List<CredentialDto> dtos = credentials.stream().map(CredentialDto::from).toList();
        return new PagedResponse<>(dtos, request.page(), request.pageSize(),
                (int)Math.ceil((double) total / request.pageSize()), total);
    }

    public CredentialDto get(UUID id) {
        logger.info("Requesting credential with ID {}", id);

        Credential credential = credentialRepository.findById(id).orElseThrow(() ->
                new BusinessException(404, "error.credential.notFound", "Credential not found"));
        return CredentialDto.from(credential);
    }

    @Transactional(rollbackFor = Exception.class)
    public void add(AddCredentialDto data) throws IOException, NoSuchAlgorithmException, NoSuchProviderException {
        Credential credential = new Credential();

        if (credentialRepository.existsByName(data.name())) {
            throw new BusinessException(409, "error.credential.alreadyExists", "Credential already exists");
        }

        credential.setName(data.name());
        credential.setDescription(data.description());
        credential.setCredentialType(data.credentialType());

        switch (data.credentialType()) {
            case SSH_PRIVATE_KEY -> {
                AsymmetricKeyParameter keyParameter =
                        CryptoUtils.parseSSHPrivateKey(data.sshPrivateKey(), data.sshPrivateKeyPassphrase());
                credential.setSshKeyInfo(CryptoUtils.resolveKeyInfo(keyParameter, false));
                credential.setSshPrivateKey(data.sshPrivateKey());
                credential.setSshPrivateKeyPassphrase(data.sshPrivateKeyPassphrase());
                credential.setExpiresAt(data.expiresAt());
            }
            case SSH_PUBLIC_KEY -> {
                AsymmetricKeyParameter keyParameter =
                        CryptoUtils.parseSSHPublicKey(data.sshPublicKey());
                credential.setSshKeyInfo(CryptoUtils.resolveKeyInfo(keyParameter, true));
                credential.setSshPublicKey(data.sshPublicKey());
                credential.setExpiresAt(data.expiresAt());
            }
            case TEXT_PASSWORD -> {
                credential.setTextPassword(data.password());
                credential.setExpiresAt(data.expiresAt());
            }
            case X509_CERTIFICATE -> {
                List<X509Certificate> chain = CryptoUtils.parseCertificateChain(data.certificate());
                PrivateKey privateKey = CryptoUtils.parseCertificatePrivateKey(
                        data.certificatePrivateKey(), data.certificatePrivateKeyPassphrase());
                CryptoUtils.validateCertificateAndPrivateKey(chain.getFirst(), privateKey);

                credential.setCertificate(data.certificate());
                credential.setCertificatePrivateKey(data.certificatePrivateKey());
                credential.setCertificatePrivateKeyPassphrase(data.certificatePrivateKeyPassphrase());
                credential.setCertificateInfo(CryptoUtils.resolveCertificateInfo(chain.getFirst()));
                // X509 凭据的过期时间始终取自证书 notAfter，忽略入参 expiresAt。
                credential.setExpiresAt(credential.getCertificateInfo().notAfter());
            }
        }

        // 新建凭据尚未被任何 platform 引用，IN_USE 检查可直接传空集合。
        credential.setStatus(computeStatus(credential, Set.of(), LocalDateTime.now()));

        logger.info("Adding credential {} with initial status {}", credential.getName(), credential.getStatus());
        credentialRepository.save(credential);
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(UUID id, UpdateCredentialDto data) {
        Credential credential = credentialRepository.findById(id).orElseThrow(() ->
                new BusinessException(404, "error.credential.notFound", "Credential not found"));

        logger.info("Updating credential {}", credential.getName());
        if (!data.name().equals(credential.getName())) {
            if (credentialRepository.existsByName(data.name())) {
                throw new BusinessException(409, "error.credential.nameAlreadyExists", "Credential name already exists");
            }
            credential.setName(data.name());
        }
        credential.setDescription(data.description());

        // X509 凭据的 expiresAt 与证书 notAfter 绑定，禁止从外部覆盖。
        if (credential.getCredentialType() == CredentialType.X509_CERTIFICATE) {
            if (data.expiresAt() != null
                    && !data.expiresAt().equals(credential.getExpiresAt())) {
                throw new BusinessException(400, "error.credential.certificate.expiresImmutable",
                        "Certificate expiration is bound to notAfter and cannot be overridden");
            }
        } else {
            credential.setExpiresAt(data.expiresAt());
        }

        // 同步刷新状态，避免列表立即展示过期信息却显示旧的 ACTIVE/IN_USE。
        Set<UUID> inUseIds = appPlatformRepository.findInUseCredentialIds();
        credential.setStatus(computeStatus(credential, inUseIds, LocalDateTime.now()));

        credentialRepository.save(credential);
    }

    @Transactional(rollbackFor = Exception.class)
    public void remove(UUID id) {
        logger.info("Removing credential with id {}", id);

        Credential credential = credentialRepository.findById(id).orElseThrow(() ->
                new BusinessException(404, "error.credential.notFound", "Credential not found"));
        if (appPlatformRepository.existsByCredentialId(credential.getId())) {
            throw new BusinessException(409, "error.credential.occupied", "Credential already occupied");
        }

        credentialRepository.delete(credential);
    }

    /**
     * 扫描所有凭据，按当前的使用情况和过期时间重算 status；仅对发生变化的实体落库。
     * 由 {@link CredentialStatusScheduler} 每 5 分钟触发一次。
     */
    @Transactional(rollbackFor = Exception.class)
    public int recomputeAllStatuses() {
        LocalDateTime now = LocalDateTime.now();
        List<Credential> credentials = credentialRepository.findAll();
        Set<UUID> inUseIds = appPlatformRepository.findInUseCredentialIds();

        int changed = 0;
        for (Credential credential : credentials) {
            CredentialStatus next = computeStatus(credential, inUseIds, now);
            if (next != credential.getStatus()) {
                logger.info("Credential {} status {} -> {}", credential.getName(), credential.getStatus(), next);
                credential.setStatus(next);
                credentialRepository.save(credential);
                changed++;
            }
        }
        return changed;
    }

    /**
     * 状态判定单点。优先级：EXPIRED > EXPIRING_SOON > IN_USE > ACTIVE。
     */
    private CredentialStatus computeStatus(Credential credential, Set<UUID> inUseIds, LocalDateTime now) {
        LocalDateTime expiresAt = credential.getExpiresAt();
        if (expiresAt != null) {
            if (expiresAt.isBefore(now)) {
                return CredentialStatus.EXPIRED;
            }
            if (expiresAt.isBefore(now.plusDays(expiringSoonDays))) {
                return CredentialStatus.EXPIRING_SOON;
            }
        }
        // credential.id 在新建场景下尚未生成，因此用 null-safe 比对。
        if (credential.getId() != null && inUseIds.contains(credential.getId())) {
            return CredentialStatus.IN_USE;
        }
        return CredentialStatus.ACTIVE;
    }
}
