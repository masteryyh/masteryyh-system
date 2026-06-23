package win.masteryyh.masteryyhsystem.platform.webshell;

import net.schmizz.sshj.SSHClient;
import net.schmizz.sshj.connection.channel.direct.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public final class WebShellSession implements AutoCloseable {
    private static final Logger logger = LoggerFactory.getLogger(WebShellSession.class);

    private final SSHClient sshClient;

    private final Session session;

    private final Session.Shell shell;

    public WebShellSession(SSHClient sshClient, Session session, Session.Shell shell) {
        this.sshClient = sshClient;
        this.session = session;
        this.shell = shell;
    }

    public OutputStream input() {
        return shell.getOutputStream();
    }

    public InputStream output() {
        return shell.getInputStream();
    }

    public InputStream errorOutput() {
        return shell.getErrorStream();
    }

    public void resize(int cols, int rows) {
        try {
            shell.changeWindowDimensions(cols, rows, 0, 0);
        } catch (IOException e) {
            logger.warn("Failed to resize PTY to cols={}, rows={}: {}", cols, rows, e.getMessage());
        }
    }

    @Override
    public void close() {
        try {
            shell.close();
        } catch (IOException ignored) {
        }
        try {
            session.close();
        } catch (IOException ignored) {
        }
        try {
            sshClient.close();
        } catch (IOException ignored) {
        }
    }
}
