package win.masteryyh.masteryyhsystem.platform;

import net.schmizz.sshj.SSHClient;
import net.schmizz.sshj.connection.channel.direct.Session;
import net.schmizz.sshj.userauth.keyprovider.KeyProvider;
import net.schmizz.sshj.userauth.method.AuthMethod;
import net.schmizz.sshj.userauth.method.AuthNone;
import net.schmizz.sshj.userauth.method.AuthPassword;
import net.schmizz.sshj.userauth.method.AuthPublickey;
import net.schmizz.sshj.userauth.password.PasswordFinder;
import net.schmizz.sshj.userauth.password.PasswordUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;
import win.masteryyh.masteryyhsystem.base.utils.DatabaseHostKeyVerifier;
import win.masteryyh.masteryyhsystem.model.AppPlatform;
import win.masteryyh.masteryyhsystem.model.Credential;
import win.masteryyh.masteryyhsystem.model.dto.CredentialType;
import win.masteryyh.masteryyhsystem.model.dto.InitSystem;
import win.masteryyh.masteryyhsystem.repository.AppPlatformRepository;
import win.masteryyh.masteryyhsystem.repository.CredentialRepository;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Component
public class SSHManager extends AbstractPlatformManager<SSHClient> {
    private static final long PROBE_TIMEOUT_SECONDS = 5;

    private static final Set<String> SYSTEMD_HEALTHY_STATES = Set.of("running", "degraded");

    private final AppPlatformRepository platformRepository;

    private final DatabaseHostKeyVerifier hostKeyVerifier;

    private final CredentialRepository credentialRepository;

    public SSHManager(AppPlatformRepository platformRepository,
                      DatabaseHostKeyVerifier hostKeyVerifier,
                      CredentialRepository credentialRepository) {
        this.platformRepository = platformRepository;
        this.hostKeyVerifier = hostKeyVerifier;
        this.credentialRepository = credentialRepository;
    }

    @Override
    protected List<AppPlatform> loadPlatforms() {
        return platformRepository.findHostPlatforms();
    }

    @Override
    protected SSHClient createClient(AppPlatform platform) throws Exception {
        SSHClient sshClient = new SSHClient();
        try {
            AuthMethod authMethod = buildAuthMethod(sshClient, platform);
            sshClient.addHostKeyVerifier(hostKeyVerifier);
            sshClient.connect(platform.getSshHost(), platform.getSshPort());
            sshClient.auth(platform.getSshUsername(), authMethod);
            testExecute(sshClient, platform.getName(), platform.getSshUsername());
            probeInitSystem(sshClient, platform);
            return sshClient;
        } catch (Exception e) {
            try {
                sshClient.close();
            } catch (IOException ignored) {
            }
            throw e;
        }
    }

    @Override
    protected boolean isHealthy(SSHClient client, AppPlatform platform) {
        if (!client.isConnected() || !client.isAuthenticated()) {
            return false;
        }
        return probeInitSystem(client, platform);
    }

    @Override
    protected void closeClient(SSHClient client) {
        try {
            client.close();
        } catch (IOException ignored) {
        }
    }

    private AuthMethod buildAuthMethod(SSHClient sshClient, AppPlatform platform) throws IOException {
        if (platform.getCredentialId() == null) {
            return new AuthNone();
        }
        Credential credential = credentialRepository.findById(platform.getCredentialId())
                .orElseThrow(() -> new IllegalStateException("Credential " + platform.getCredentialId() + " not found"));
        if (credential.getCredentialType().equals(CredentialType.SSH_PRIVATE_KEY)) {
            PasswordFinder passwordFinder = null;
            if (StringUtils.isNotEmpty(credential.getSshPrivateKeyPassphrase())) {
                passwordFinder = PasswordUtils.createOneOff(credential.getSshPrivateKeyPassphrase().toCharArray());
            }
            KeyProvider provider = sshClient.loadKeys(credential.getSshPrivateKey(), null, passwordFinder);
            return new AuthPublickey(provider);
        } else if (credential.getCredentialType().equals(CredentialType.TEXT_PASSWORD)) {
            return new AuthPassword(PasswordUtils.createOneOff(credential.getTextPassword().toCharArray()));
        }
        return new AuthNone();
    }

    private void testExecute(SSHClient client, String platformName, String expectedName) throws IOException {
        try (Session session = client.startSession()) {
            Session.Command cmd = session.exec("whoami");
            String output = new String(cmd.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim()
                    .replace("\r\n", "").replace("\n", "");
            if (!output.equals(expectedName)) {
                logger.warn("Username returned by platform {} is not the same as DB record: returned {}, expected {}",
                        platformName, output, expectedName);
            }
        }
    }

    private boolean probeInitSystem(SSHClient client, AppPlatform platform) {
        InitSystem initSystem = platform.getInitSystem();
        if (initSystem == null) {
            logger.warn("Platform {} has no initSystem configured, skip probe", platform.getName());
            return true;
        }
        try {
            return switch (initSystem) {
                case SYSTEMD -> probeSystemd(client, platform);
                case OPENRC -> probeOpenrc(client, platform);
            };
        } catch (Exception e) {
            logger.warn("Failed to probe init system {} for platform {}: {}",
                    initSystem, platform.getName(), e.getMessage());
            return false;
        }
    }

    private boolean probeSystemd(SSHClient client, AppPlatform platform) throws IOException {
        try (Session session = client.startSession()) {
            Session.Command cmd = session.exec("systemctl is-system-running");
            cmd.join(PROBE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            String output = new String(cmd.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            String state = output.split("\\s+", 2)[0];
            logger.debug("Platform {} systemctl is-system-running -> state={}, exit={}",
                    platform.getName(), state, cmd.getExitStatus());
            return SYSTEMD_HEALTHY_STATES.contains(state);
        }
    }

    private boolean probeOpenrc(SSHClient client, AppPlatform platform) throws IOException {
        try (Session session = client.startSession()) {
            Session.Command cmd = session.exec("rc-status");
            cmd.join(PROBE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            Integer exit = cmd.getExitStatus();
            logger.debug("Platform {} rc-status -> exit={}", platform.getName(), exit);
            return exit != null && exit == 0;
        }
    }
}
