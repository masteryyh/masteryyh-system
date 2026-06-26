package win.masteryyh.masteryyhsystem.base.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;

@Configuration
public class S3Configuration {
    @Bean
    public S3Client s3Client(SystemConfiguration configuration) {
        return S3Client.builder()
                .endpointOverride(URI.create(configuration.getFile().getS3().getEndpoint()))
                .region(Region.of(configuration.getFile().getS3().getRegion()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(configuration.getFile().getS3().getAccessKey(), configuration.getFile().getS3().getSecretKey())))
                .serviceConfiguration(software.amazon.awssdk.services.s3.S3Configuration.builder()
                        .pathStyleAccessEnabled(configuration.getFile().getS3().getPathStyleAccess())
                        .build())
                .build();
    }
}
