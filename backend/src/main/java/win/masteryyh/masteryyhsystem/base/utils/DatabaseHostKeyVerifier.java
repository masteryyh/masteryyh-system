package win.masteryyh.masteryyhsystem.base.utils;

import net.schmizz.sshj.common.Buffer;
import net.schmizz.sshj.common.KeyType;
import net.schmizz.sshj.transport.verification.HostKeyVerifier;
import org.bouncycastle.util.encoders.Base64;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import win.masteryyh.masteryyhsystem.base.utils.crypto.CryptoUtils;
import win.masteryyh.masteryyhsystem.model.AppPlatform;
import win.masteryyh.masteryyhsystem.repository.AppPlatformRepository;

import java.security.PublicKey;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
public class DatabaseHostKeyVerifier implements HostKeyVerifier {
    private static final Logger logger = LoggerFactory.getLogger(DatabaseHostKeyVerifier.class);

    private final AppPlatformRepository appPlatformRepository;

    private final Map<String, AppPlatform> platformCache;

    public DatabaseHostKeyVerifier(AppPlatformRepository appPlatformRepository) {
        this.appPlatformRepository = appPlatformRepository;
        this.platformCache = new ConcurrentHashMap<>();
    }

    @Override
    public boolean verify(String hostname, int port, PublicKey key) {
        if (KeyType.fromKey(key).equals(KeyType.UNKNOWN)) {
            return false;
        }

        String cacheKey = hostname + ":" + port;
        AppPlatform appPlatform = platformCache.get(cacheKey);
        if (appPlatform == null) {
            Optional<AppPlatform> optionalPlatform =
                    appPlatformRepository.findByHostPort(hostname, port);
            if (optionalPlatform.isEmpty()) {
                return false;
            }
            appPlatform = optionalPlatform.get();
        }
        platformCache.remove(cacheKey);  

        byte[] sshWireKey;
        try {
            Buffer.PlainBuffer buffer = new Buffer.PlainBuffer();
            buffer.putPublicKey(key);
            sshWireKey = buffer.getCompactData();
        } catch (Exception e) {
            logger.warn("Failed to serialize host key for {}:{}: ", hostname, port, e);
            return false;
        }
        String base64 = Base64.toBase64String(sshWireKey);

        List<String> hostKeys = appPlatform.getHostKeys();
        if (!CollectionUtils.isEmpty(hostKeys)) {
            Set<String> hostKeyValues = appPlatform.getHostKeys().stream()
                    .map(hostKey -> hostKey.split(" ")[2]).collect(Collectors.toSet());
            return hostKeyValues.contains(base64);
        }

        final AppPlatform copy = appPlatform;
        final byte[] keyBytes = sshWireKey;
        CompletableFuture.runAsync(() -> {
            try {
                String header = CryptoUtils.resolveSSHPublicKeyHeader(keyBytes);
                String entry = port == 22
                        ? String.format("%s %s %s", hostname, header, base64)
                        : String.format("[%s]:%d %s %s", hostname, port, header, base64);
                appPlatformRepository.updateHostKey(copy.getId(), entry);
            } catch (Exception e) {
                logger.warn("An error occurred while saving known host entry: ", e);
            }
        }, AsyncTaskExecutor.getInstance());
        return true;
    }

    @Override
    public List<String> findExistingAlgorithms(String hostname, int port) {
        Optional<AppPlatform> optionalPlatform =
                appPlatformRepository.findByHostPort(hostname, port);
        if (optionalPlatform.isEmpty()) {
            return List.of();
        }
        AppPlatform platform = optionalPlatform.get();
        platformCache.put(hostname + ":" + port, platform);

        if (!CollectionUtils.isEmpty(platform.getHostKeys())) {
            return platform.getHostKeys().stream()
                    .map(key -> key.split(" ")[1]).toList();
        }
        return List.of();
    }
}
