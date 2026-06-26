package win.masteryyh.masteryyhsystem.base.utils;

import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import win.masteryyh.masteryyhsystem.base.config.SystemConfiguration;

import java.io.InputStream;

@Component
public class S3FileManager {
    private final S3Client client;

    private final String bucket;

    public S3FileManager(S3Client client,
                         SystemConfiguration configuration) {
        this.client = client;
        this.bucket = configuration.getFile().getS3().getBucket();
    }

    public void put(String objectKey, String contentType, long size, InputStream inputStream) {
        client.putObject(PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(objectKey)
                        .contentType(contentType)
                        .contentLength(size)
                        .build(),
                RequestBody.fromInputStream(inputStream, size));
    }

    public ResponseInputStream<GetObjectResponse> get(String objectKey) {
        return client.getObject(GetObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .build());
    }

    public void delete(String objectKey) {
        client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .build());
    }
}
