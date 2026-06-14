package win.masteryyh.masteryyhsystem.base.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "system")
public class SystemConfiguration {
    private AdminConfig admin;

    private String jwtSecret;

    @Data
    public static class AdminConfig {
        private String username;

        private String password;

        private String email;
    }
}
