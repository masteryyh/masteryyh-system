package win.masteryyh.masteryyhsystem.base.utils;

import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry;
import org.apache.commons.compress.archivers.zip.ZipArchiveInputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream;
import org.apache.commons.lang3.StringUtils;
import org.bouncycastle.openssl.jcajce.JcaPEMWriter;
import org.springframework.stereotype.Service;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.base.utils.crypto.CryptoUtils;
import win.masteryyh.masteryyhsystem.model.Credential;
import win.masteryyh.masteryyhsystem.model.GatewayConfig;
import win.masteryyh.masteryyhsystem.model.GatewayEntryPoint;
import win.masteryyh.masteryyhsystem.model.GatewayRoute;
import win.masteryyh.masteryyhsystem.model.StoredFile;
import win.masteryyh.masteryyhsystem.model.dto.DeploymentBundle;
import win.masteryyh.masteryyhsystem.model.dto.GatewayRouteType;
import win.masteryyh.masteryyhsystem.repository.CredentialRepository;
import win.masteryyh.masteryyhsystem.repository.GatewayEntryPointRepository;
import win.masteryyh.masteryyhsystem.repository.GatewayRouteRepository;
import win.masteryyh.masteryyhsystem.repository.StoredFileRepository;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.security.PrivateKey;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class NginxHelper {
    private final GatewayEntryPointRepository entryPointRepository;

    private final GatewayRouteRepository routeRepository;

    private final CredentialRepository credentialRepository;

    private final StoredFileRepository fileRepository;

    private final S3FileManager storage;

    private final StaticArchiveValidator archiveValidator;

    private final NginxConfigCodec codec;

    public NginxHelper(GatewayEntryPointRepository entryPointRepository,
                       GatewayRouteRepository routeRepository,
                       CredentialRepository credentialRepository,
                       StoredFileRepository fileRepository,
                       S3FileManager storage,
                       StaticArchiveValidator archiveValidator,
                       NginxConfigCodec codec) {
        this.entryPointRepository = entryPointRepository;
        this.routeRepository = routeRepository;
        this.credentialRepository = credentialRepository;
        this.fileRepository = fileRepository;
        this.storage = storage;
        this.archiveValidator = archiveValidator;
        this.codec = codec;
    }

    public DeploymentBundle build(GatewayConfig gateway) {
        codec.requireSafeName(gateway.getName(), "gateway");
        codec.validateMainConfig(gateway.getConfigContent());

        List<GatewayEntryPoint> entryPoints =
                entryPointRepository.findByGatewayIdOrderByListenPortAscNameAsc(gateway.getId());
        Map<String, byte[]> files = new LinkedHashMap<>();
        if (StringUtils.isNotBlank(gateway.getConfigContent())) {
            files.put("main/nginx.conf", gateway.getConfigContent().getBytes(StandardCharsets.UTF_8));
        }

        for (GatewayEntryPoint entryPoint : entryPoints) {
            List<GatewayRoute> routes =
                    routeRepository.findByEntryPointIdOrderByPriorityDescPathPrefixAsc(entryPoint.getId());
            String filename = codec.filename(gateway.getName(), entryPoint.getName());
            String configContent = StringUtils.defaultIfBlank(entryPoint.getCurrentConfigContent(),
                    codec.write(entryPoint, routes));
            files.put("conf.d/" + filename, configContent.getBytes(StandardCharsets.UTF_8));

            if (entryPoint.getCertificateCredentialId() != null) {
                addCertificate(files, entryPoint);
            }
            for (GatewayRoute route : routes) {
                if (route.getRouteType() == GatewayRouteType.STATIC) {
                    addStaticArchive(files, gateway.getId(), route);
                }
            }
        }
        return new DeploymentBundle(files, entryPoints.stream().map(GatewayEntryPoint::getListenPort).distinct().toList(),
                StringUtils.isNotBlank(gateway.getConfigContent()));
    }

    public byte[] dockerTar(DeploymentBundle bundle) {
        Map<String, byte[]> mapped = new LinkedHashMap<>();
        bundle.files().forEach((path, bytes) -> {
            if (path.equals("main/nginx.conf")) {
                mapped.put("etc/nginx/nginx.conf", bytes);
            } else if (path.startsWith("conf.d/")) {
                mapped.put("etc/nginx/" + path, bytes);
            } else if (path.startsWith("certs/")) {
                mapped.put("etc/nginx/masteryyh/" + path, bytes);
            } else if (path.startsWith("static/")) {
                mapped.put("var/www/masteryyh/" + path.substring("static/".length()), bytes);
            }
        });
        return tar(mapped, false);
    }

    public byte[] hostTar(DeploymentBundle bundle) {
        return tar(bundle.files(), true);
    }

    private void addCertificate(Map<String, byte[]> files, GatewayEntryPoint entryPoint) {
        Credential credential = credentialRepository.findById(entryPoint.getCertificateCredentialId())
                .orElseThrow(() -> new BusinessException(404, "error.credential.notFound",
                        "Certificate credential not found"));
        PrivateKey privateKey = CryptoUtils.parseCertificatePrivateKey(
                credential.getCertificatePrivateKey(), credential.getCertificatePrivateKeyPassphrase());
        StringWriter privateKeyPem = new StringWriter();
        try (JcaPEMWriter writer = new JcaPEMWriter(privateKeyPem)) {
            writer.writeObject(privateKey);
        } catch (IOException e) {
            throw new BusinessException(500, "error.gateway.certificate.writeFailed",
                    "Failed to serialize certificate private key");
        }
        String prefix = "certs/" + entryPoint.getGatewayId() + "/" + entryPoint.getId() + "/";
        files.put(prefix + "certificate.pem", credential.getCertificate().getBytes(StandardCharsets.UTF_8));
        files.put(prefix + "private-key.pem", privateKeyPem.toString().getBytes(StandardCharsets.UTF_8));
    }

    private void addStaticArchive(Map<String, byte[]> files, UUID gatewayId, GatewayRoute route) {
        StoredFile file = fileRepository.findById(route.getStaticFileId())
                .orElseThrow(() -> new BusinessException(404, "error.file.notFound",
                        "Static resource file not found"));
        archiveValidator.validate(file);
        String prefix = "static/" + gatewayId + "/" + route.getId() + "/";
        try (var object = storage.get(file.getObjectKey());
             var zip = new ZipArchiveInputStream(object)) {
            ZipArchiveEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.isDirectory()) {
                    continue;
                }
                String name = entry.getName().replace('\\', '/');
                files.put(prefix + name, zip.readAllBytes());
            }
        } catch (IOException e) {
            throw new BusinessException(500, "error.gateway.staticFile.readFailed",
                    "Failed to extract static resource ZIP: " + e.getMessage());
        }
    }

    private byte[] tar(Map<String, byte[]> files, boolean gzip) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            var output = gzip ? new GzipCompressorOutputStream(bytes) : bytes;
            try (TarArchiveOutputStream tar = new TarArchiveOutputStream(output)) {
                tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX);
                for (Map.Entry<String, byte[]> item : files.entrySet()) {
                    TarArchiveEntry entry = new TarArchiveEntry(item.getKey());
                    entry.setSize(item.getValue().length);
                    entry.setMode(item.getKey().endsWith("private-key.pem") ? 0600 : 0644);
                    tar.putArchiveEntry(entry);
                    try (ByteArrayInputStream input = new ByteArrayInputStream(item.getValue())) {
                        input.transferTo(tar);
                    }
                    tar.closeArchiveEntry();
                }
                tar.finish();
            }
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new BusinessException(500, "error.gateway.bundleFailed",
                    "Failed to build gateway deployment bundle: " + e.getMessage());
        }
    }
}
