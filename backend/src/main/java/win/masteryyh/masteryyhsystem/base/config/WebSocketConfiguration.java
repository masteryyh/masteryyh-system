package win.masteryyh.masteryyhsystem.base.config;

import tools.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import win.masteryyh.masteryyhsystem.base.security.WebSocketHandshakeAuthInterceptor;
import win.masteryyh.masteryyhsystem.platform.SSHManager;
import win.masteryyh.masteryyhsystem.platform.webshell.WebShellHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfiguration implements WebSocketConfigurer {
    private final SSHManager sshManager;

    private final ObjectMapper mapper;

    private final WebSocketHandshakeAuthInterceptor handshakeInterceptor;

    public WebSocketConfiguration(SSHManager sshManager,
            ObjectMapper mapper,
            WebSocketHandshakeAuthInterceptor handshakeInterceptor) {
        this.sshManager = sshManager;
        this.mapper = mapper;
        this.handshakeInterceptor = handshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new WebShellHandler(sshManager, mapper), "/v1/webshell/{platformId}")
                .addInterceptors(handshakeInterceptor)
                .setAllowedOriginPatterns("*");
    }
}
