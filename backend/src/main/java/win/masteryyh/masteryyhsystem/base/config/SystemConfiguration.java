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

    private FileConfig file;

    @Data
    public static class AdminConfig {
        private String username;

        private String password;

        private String email;
    }

    @Data
    public static class FileConfig {
        private S3Config s3;

        private Long maxSize;

        @Data
        public static class S3Config {
            private String endpoint;

            private String region;

            private String accessKey;

            private String secretKey;

            private Boolean pathStyleAccess;

            private String bucket;
        }
    }


}
