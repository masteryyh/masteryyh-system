package win.masteryyh.masteryyhsystem.platform;

import net.schmizz.sshj.SSHClient;
import net.schmizz.sshj.connection.channel.direct.Session;
import net.schmizz.sshj.sftp.SFTPClient;
import net.schmizz.sshj.userauth.keyprovider.KeyProvider;
import net.schmizz.sshj.userauth.method.AuthMethod;
import net.schmizz.sshj.userauth.method.AuthNone;
import net.schmizz.sshj.userauth.method.AuthPassword;
import net.schmizz.sshj.userauth.method.AuthPublickey;
import net.schmizz.sshj.userauth.password.PasswordFinder;
import net.schmizz.sshj.userauth.password.PasswordUtils;
import net.schmizz.sshj.xfer.FileSystemFile;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.base.utils.DatabaseHostKeyVerifier;
import win.masteryyh.masteryyhsystem.model.AppPlatform;
import win.masteryyh.masteryyhsystem.model.Credential;
import win.masteryyh.masteryyhsystem.model.dto.CredentialType;
import win.masteryyh.masteryyhsystem.model.dto.InitSystem;
import win.masteryyh.masteryyhsystem.model.dto.PlatformType;
import win.masteryyh.masteryyhsystem.platform.webshell.WebShellSession;
import win.masteryyh.masteryyhsystem.repository.AppPlatformRepository;
import win.masteryyh.masteryyhsystem.repository.CredentialRepository;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

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

    public WebShellSession openShell(UUID platformId, int cols, int rows) {
        AppPlatform platform = platformRepository.findById(platformId)
                .orElseThrow(() -> new BusinessException(
                        404, "error.platform.notFound", "Platform " + platformId + " not found"));
        if (platform.getPlatformType() != PlatformType.HOST) {
            throw new BusinessException(
                    400, "error.platform.shellNotSupported",
                    "Web shell is only supported on HOST platforms");
        }

        SSHClient sshClient = null;
        Session session = null;
        Session.Shell shell = null;
        try {
            sshClient = createClient(platform);
            session = sshClient.startSession();
            session.allocatePTY("xterm-256color", cols, rows, 0, 0, Collections.emptyMap());
            shell = session.startShell();
            return new WebShellSession(sshClient, session, shell);
        } catch (Exception e) {
            if (shell != null) {
                try {
                    shell.close();
                } catch (IOException ignored) {
                }
            }
            if (session != null) {
                try {
                    session.close();
                } catch (IOException ignored) {
                }
            }
            if (sshClient != null) {
                try {
                    sshClient.close();
                } catch (IOException ignored) {
                }
            }
            throw new BusinessException(
                    500, "error.platform.shellOpenFailed",
                    "Failed to open shell: " + e.getMessage());
        }
    }

    public CommandResult runCommand(UUID platformId, String command, long timeoutSec) {
        AppPlatform platform = platformRepository.findById(platformId)
                .orElseThrow(() -> new BusinessException(404, "error.platform.notFound",
                        "Platform " + platformId + " not found"));
        if (platform.getPlatformType() != PlatformType.HOST) {
            throw new BusinessException(400, "error.platform.notHost",
                    "Remote commands are only supported on HOST platforms");
        }

        SSHClient sshClient = null;
        try {
            sshClient = createClient(platform);
            return execCommand(sshClient, command, timeoutSec);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            logger.warn("Failed to run remote command on platform {}: ", platformId, e);
            throw new BusinessException(500, "error.platform.commandFailed",
                    "Failed to run remote command: " + e.getMessage());
        } finally {
            if (sshClient != null) {
                try {
                    sshClient.close();
                } catch (IOException ignored) {
                }
            }
        }
    }

    public void uploadBytes(UUID platformId, byte[] content, String remotePath) {
        AppPlatform platform = platformRepository.findById(platformId)
                .orElseThrow(() -> new BusinessException(404, "error.platform.notFound",
                        "Platform " + platformId + " not found"));
        if (!platform.getPlatformType().equals(PlatformType.HOST)) {
            throw new BusinessException(400, "error.platform.notHost",
                    "File upload is only supported on HOST platforms");
        }

        Path temp = null;
        SSHClient sshClient = null;
        SFTPClient sftp = null;
        try {
            temp = Files.createTempFile("masteryyh-upload-", ".bin");
            Files.write(temp, content);

            sshClient = createClient(platform);
            sftp = sshClient.newSFTPClient();

            int slash = remotePath.lastIndexOf('/');
            if (slash > 0) {
                String parent = remotePath.substring(0, slash);
                try {
                    sftp.mkdirs(parent);
                } catch (IOException ignored) {}
            }
            sftp.put(new FileSystemFile(temp.toFile()), remotePath);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            logger.warn("Failed to upload file to platform {}: ", platformId, e);
            throw new BusinessException(500, "error.platform.uploadFailed",
                    "Failed to upload file: " + e.getMessage());
        } finally {
            if (sftp != null) {
                try {
                    sftp.close();
                } catch (IOException ignored) {
                }
            }
            if (sshClient != null) {
                try {
                    sshClient.close();
                } catch (IOException ignored) {
                }
            }
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (IOException ignored) {
                }
            }
        }
    }

    private CommandResult execCommand(SSHClient sshClient, String command, long timeoutSec) throws IOException {
        try (Session session = sshClient.startSession()) {
            Session.Command cmd = session.exec(command);

            AtomicReference<byte[]> stdoutRef = new AtomicReference<>();
            AtomicReference<byte[]> stderrRef = new AtomicReference<>();
            Thread outReader = Thread.ofVirtual().start(() -> {
                try {
                    stdoutRef.set(cmd.getInputStream().readAllBytes());
                } catch (IOException e) {
                    stdoutRef.set(new byte[0]);
                }
            });
            Thread errReader = Thread.ofVirtual().start(() -> {
                try {
                    stderrRef.set(cmd.getErrorStream().readAllBytes());
                } catch (IOException e) {
                    stderrRef.set(new byte[0]);
                }
            });

            cmd.join(timeoutSec, TimeUnit.SECONDS);
            Integer exit = cmd.getExitStatus();
            if (exit == null) {
                cmd.close();
                try {
                    outReader.join();
                    errReader.join();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return new CommandResult(-1,
                        new String(stdoutRef.get(), StandardCharsets.UTF_8),
                        "Command timed out after " + timeoutSec + "s");
            }
            try {
                outReader.join();
                errReader.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }

            String stdout = new String(stdoutRef.get(), StandardCharsets.UTF_8);
            String stderr = new String(stderrRef.get(), StandardCharsets.UTF_8);
            return new CommandResult(exit, stdout, stderr);
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
