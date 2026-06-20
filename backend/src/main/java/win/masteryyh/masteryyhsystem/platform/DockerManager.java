package win.masteryyh.masteryyhsystem.platform;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.core.DefaultDockerClientConfig;
import com.github.dockerjava.core.DockerClientConfig;
import com.github.dockerjava.core.DockerClientImpl;
import com.github.dockerjava.transport.DockerHttpClient;
import com.github.dockerjava.zerodep.ZerodepDockerHttpClient;
import org.springframework.stereotype.Component;
import win.masteryyh.masteryyhsystem.model.AppPlatform;
import win.masteryyh.masteryyhsystem.repository.AppPlatformRepository;

import java.util.List;

@Component
public class DockerManager extends AbstractPlatformManager<DockerClient> {
    private final AppPlatformRepository appPlatformRepository;

    public DockerManager(AppPlatformRepository appPlatformRepository) {
        this.appPlatformRepository = appPlatformRepository;
    }

    @Override
    protected List<AppPlatform> loadPlatforms() {
        return appPlatformRepository.findDockerPlatforms();
    }

    @Override
    protected DockerClient createClient(AppPlatform platform) {
        DockerClientConfig clientConfig = DefaultDockerClientConfig.createDefaultConfigBuilder()
                .withDockerHost(platform.getDockerHost())
                .build();
        DockerHttpClient httpClient = new ZerodepDockerHttpClient.Builder()
                .dockerHost(clientConfig.getDockerHost())
                .build();
        DockerClient dockerClient = DockerClientImpl.getInstance(clientConfig, httpClient);
        try {
            dockerClient.pingCmd().exec();
            return dockerClient;
        } catch (Exception e) {
            try {
                httpClient.close();
            } catch (Exception ignored) {
            }
            throw e;
        }
    }

    @Override
    protected boolean isHealthy(DockerClient client) {
        try {
            client.pingCmd().exec();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void closeClient(DockerClient client) {
        try {
            client.close();
        } catch (Exception ignored) {
        }
    }
}
