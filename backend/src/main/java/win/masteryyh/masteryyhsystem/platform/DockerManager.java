package win.masteryyh.masteryyhsystem.platform;

import com.github.dockerjava.api.DockerClient;
import com.github.dockerjava.api.command.InspectImageResponse;
import com.github.dockerjava.api.command.ListVolumesResponse;
import com.github.dockerjava.api.model.Container;
import com.github.dockerjava.api.model.ContainerPort;
import com.github.dockerjava.api.model.Image;
import com.github.dockerjava.api.model.Network;
import com.github.dockerjava.core.DefaultDockerClientConfig;
import com.github.dockerjava.core.DockerClientConfig;
import com.github.dockerjava.core.DockerClientImpl;
import com.github.dockerjava.transport.DockerHttpClient;
import com.github.dockerjava.zerodep.ZerodepDockerHttpClient;
import org.springframework.stereotype.Component;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.model.AppPlatform;
import win.masteryyh.masteryyhsystem.model.dto.docker.DockerContainerDto;
import win.masteryyh.masteryyhsystem.model.dto.docker.DockerImageDto;
import win.masteryyh.masteryyhsystem.model.dto.docker.DockerNetworkDto;
import win.masteryyh.masteryyhsystem.model.dto.docker.DockerVolumeDto;
import win.masteryyh.masteryyhsystem.repository.AppPlatformRepository;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

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
    protected boolean isHealthy(DockerClient client, AppPlatform platform) {
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

    public List<DockerContainerDto> listContainers(UUID id) {
        DockerClient client = requireClient(id);
        List<Container> containers = client.listContainersCmd().withShowAll(true).exec();
        return containers.stream()
                .map(DockerManager::toContainerDto)
                .toList();
    }

    public List<DockerImageDto> listImages(UUID id) {
        DockerClient client = requireClient(id);
        List<Image> images = client.listImagesCmd().withShowAll(true).exec();
        return images.stream()
                .map(image -> toImageDto(client, image))
                .toList();
    }

    public List<DockerNetworkDto> listNetworks(UUID id) {
        DockerClient client = requireClient(id);
        List<Network> networks = client.listNetworksCmd().exec();
        return networks.stream()
                .map(DockerManager::toNetworkDto)
                .toList();
    }

    public List<DockerVolumeDto> listVolumes(UUID id) {
        DockerClient client = requireClient(id);
        ListVolumesResponse response = client.listVolumesCmd().exec();
        return response.getVolumes().stream()
                .map(volume -> new DockerVolumeDto(volume.getName(), volume.getDriver(), volume.getMountpoint()))
                .toList();
    }

    private DockerClient requireClient(UUID id) {
        return getClient(id).orElseThrow(() ->
                new BusinessException(503, "error.platform.offline", "Docker platform is offline"));
    }

    private static DockerContainerDto toContainerDto(Container container) {
        String name = container.getNames() != null && container.getNames().length > 0
                ? container.getNames()[0]
                : null;
        if (name != null && name.startsWith("/")) {
            name = name.substring(1);
        }
        List<String> ports = container.getPorts() == null ? List.of()
                : Arrays.stream(container.getPorts())
                .filter(port -> port.getPrivatePort() != null)
                .map(DockerManager::describePort)
                .toList();
        // Docker Engine 返回的容器 Created 是 Unix 秒，统一转为毫秒下发。
        Long createdAtMs = container.getCreated() == null ? null
                : container.getCreated() * 1000L;
        return new DockerContainerDto(
                container.getId(),
                name,
                container.getImage(),
                container.getImageId(),
                container.getState(),
                container.getStatus(),
                createdAtMs,
                container.getCommand(),
                ports
        );
    }

    private static String describePort(ContainerPort port) {
        if (port.getPublicPort() != null) {
            return port.getIp() == null
                    ? port.getPublicPort() + ":" + port.getPrivatePort() + "/" + port.getType()
                    : port.getIp() + ":" + port.getPublicPort() + "->" + port.getPrivatePort() + "/" + port.getType();
        }
        return port.getPrivatePort() + "/" + port.getType();
    }

    private static DockerImageDto toImageDto(DockerClient client, Image image) {
        String arch = null;
        String os = null;
        String createdAt = null;
        Long size = image.getSize();
        try {
            InspectImageResponse detail = client.inspectImageCmd(image.getId()).exec();
            arch = detail.getArch();
            os = detail.getOs();
            createdAt = detail.getCreated();
            if (size == null) {
                size = detail.getSize();
            }
        } catch (Exception ignored) {}
        List<String> repoTags = image.getRepoTags() == null ? List.of()
                : Arrays.asList(image.getRepoTags());
        return new DockerImageDto(image.getId(), repoTags, arch, os, size, createdAt);
    }

    private static DockerNetworkDto toNetworkDto(Network network) {
        return new DockerNetworkDto(
                network.getId(),
                network.getName(),
                network.getDriver(),
                network.getScope(),
                Boolean.TRUE.equals(network.getInternal())
        );
    }
}
