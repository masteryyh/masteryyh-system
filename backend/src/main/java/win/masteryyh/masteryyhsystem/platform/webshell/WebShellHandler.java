package win.masteryyh.masteryyhsystem.platform.webshell;

import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.platform.SSHManager;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class WebShellHandler extends TextWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(WebShellHandler.class);

    private static final int BUFFER_SIZE = 8192;

    private final SSHManager sshManager;

    private final ObjectMapper objectMapper;

    private final Map<String, WebShellSession> sessions;

    public WebShellHandler(SSHManager sshManager, ObjectMapper objectMapper) {
        this.sshManager = sshManager;
        this.objectMapper = objectMapper;

        this.sessions = new ConcurrentHashMap<>();
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession wsSession) {
        Map<String, Object> attrs = wsSession.getAttributes();
        UUID platformId = (UUID) attrs.get("platformId");
        int cols = (int) attrs.getOrDefault("cols", 80);
        int rows = (int) attrs.getOrDefault("rows", 24);

        if (platformId == null) {
            sendError(wsSession, "Missing platformId");
            closeQuietly(wsSession, CloseStatus.POLICY_VIOLATION);
            return;
        }

        WebShellSession shell;
        try {
            shell = sshManager.openShell(platformId, cols, rows);
        } catch (BusinessException e) {
            sendError(wsSession, e.getMessage());
            closeQuietly(wsSession, CloseStatus.SERVER_ERROR);
            return;
        } catch (Exception e) {
            sendError(wsSession, "Failed to open shell: " + e.getMessage());
            closeQuietly(wsSession, CloseStatus.SERVER_ERROR);
            return;
        }

        sessions.put(wsSession.getId(), shell);
        startReader(wsSession, shell.output());
        startReader(wsSession, shell.errorOutput());
    }

    private void startReader(WebSocketSession wsSession, InputStream in) {
        Thread.ofVirtual().name("webshell-reader-" + wsSession.getId()).start(() -> {
            byte[] buffer = new byte[BUFFER_SIZE];
            try {
                int n;
                while ((n = in.read(buffer)) != -1) {
                    if (n == 0) {
                        continue;
                    }
                    if (wsSession.isOpen()) {
                        wsSession.sendMessage(new BinaryMessage(buffer, 0, n, true));
                    }
                }
            } catch (IOException e) {
                logger.debug("Shell stream closed for {}: {}", wsSession.getId(), e.getMessage());
            }
            sendJson(wsSession, Map.of("type", "closed"));
            closeQuietly(wsSession, CloseStatus.NORMAL);
        });
    }

    @Override
    protected void handleTextMessage(WebSocketSession wsSession, TextMessage message) {
        WebShellSession shell = sessions.get(wsSession.getId());
        if (shell == null) {
            return;
        }
        WebShellMessage msg;
        try {
            msg = objectMapper.readValue(message.getPayload(), WebShellMessage.class);
        } catch (Exception e) {
            return;
        }
        try {
            switch (msg.type() == null ? "" : msg.type()) {
                case "input" -> {
                    if (msg.data() != null) {
                        shell.input().write(msg.data().getBytes(StandardCharsets.UTF_8));
                        shell.input().flush();
                    }
                }
                case "resize" -> {
                    if (msg.cols() != null && msg.rows() != null) {
                        shell.resize(msg.cols(), msg.rows());
                    }
                }
                default -> {
                }
            }
        } catch (IOException e) {
            logger.warn("Failed to handle shell message {}: {}", msg.type(), e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession wsSession, CloseStatus status) {
        closeShell(wsSession);
    }

    @Override
    public void handleTransportError(WebSocketSession wsSession, Throwable exception) {
        logger.warn("WebShell transport error for {}: {}", wsSession.getId(), exception.getMessage());
        closeShell(wsSession);
    }

    private void closeShell(WebSocketSession wsSession) {
        WebShellSession shell = sessions.remove(wsSession.getId());
        if (shell != null) {
            shell.close();
        }
    }

    private void sendJson(WebSocketSession wsSession, Map<String, Object> payload) {
        if (!wsSession.isOpen()) {
            return;
        }
        try {
            wsSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
        } catch (IOException e) {
            logger.debug("Failed to send to {}: {}", wsSession.getId(), e.getMessage());
        }
    }

    private void sendError(WebSocketSession wsSession, String message) {
        sendJson(wsSession, Map.of("type", "error", "message", message == null ? "" : message));
    }

    private void closeQuietly(WebSocketSession wsSession, CloseStatus status) {
        try {
            wsSession.close(status);
        } catch (IOException ignored) {
        }
    }
}
