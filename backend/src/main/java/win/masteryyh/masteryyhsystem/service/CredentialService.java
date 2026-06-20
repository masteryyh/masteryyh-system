package win.masteryyh.masteryyhsystem.service;

import org.bouncycastle.crypto.params.AsymmetricKeyParameter;
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
import win.masteryyh.masteryyhsystem.base.utils.crypto.CryptoUtils;
import win.masteryyh.masteryyhsystem.model.Credential;
import win.masteryyh.masteryyhsystem.model.dto.AddCredentialDto;
import win.masteryyh.masteryyhsystem.model.dto.CredentialDto;
import win.masteryyh.masteryyhsystem.model.dto.UpdateCredentialDto;
import win.masteryyh.masteryyhsystem.repository.AppPlatformRepository;
import win.masteryyh.masteryyhsystem.repository.CredentialRepository;

import java.io.IOException;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.util.List;
import java.util.UUID;

@Service
public class CredentialService {
    private static final Logger logger = LoggerFactory.getLogger(CredentialService.class);

    private final CredentialRepository credentialRepository;

    private final AppPlatformRepository appPlatformRepository;

    public CredentialService(CredentialRepository credentialRepository,
                             AppPlatformRepository appPlatformRepository) {
        this.credentialRepository = credentialRepository;
        this.appPlatformRepository = appPlatformRepository;
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
                new BusinessException(404, "Credential not found"));
        return CredentialDto.from(credential);
    }

    @Transactional(rollbackFor = Exception.class)
    public void add(AddCredentialDto data) throws IOException, NoSuchAlgorithmException, NoSuchProviderException {
        Credential credential = new Credential();

        if (credentialRepository.existsByName(data.name())) {
            throw new BusinessException(409, "Credential already exists");
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
            }
            case SSH_PUBLIC_KEY -> {
                AsymmetricKeyParameter keyParameter =
                        CryptoUtils.parseSSHPublicKey(data.sshPublicKey());
                credential.setSshKeyInfo(CryptoUtils.resolveKeyInfo(keyParameter, true));
                credential.setSshPublicKey(data.sshPublicKey());
            }
            case TEXT_PASSWORD -> credential.setTextPassword(data.password());
        }

        logger.info("Adding credential {}", credential.getName());
        credentialRepository.save(credential);
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(UUID id, UpdateCredentialDto data) {
        Credential credential = credentialRepository.findById(id).orElseThrow(() ->
                new BusinessException(404, "Credential not found"));

        logger.info("Updating credential {}", credential.getName());
        if (!data.name().equals(credential.getName())) {
            if (credentialRepository.existsByName(data.name())) {
                throw new BusinessException(409, "Credential name already exists");
            }
            credential.setName(data.name());
        }
        credential.setDescription(data.description());
        credentialRepository.save(credential);
    }

    @Transactional(rollbackFor = Exception.class)
    public void remove(UUID id) {
        logger.info("Removing credential with id {}", id);

        Credential credential = credentialRepository.findById(id).orElseThrow(() ->
                new BusinessException(404, "Credential not found"));
        if (appPlatformRepository.existsByCredentialId(credential.getId())) {
            throw new BusinessException(409, "Credential already occupied");
        }

        credentialRepository.delete(credential);
    }
}
