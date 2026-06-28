package win.masteryyh.masteryyhsystem.controller;

import jakarta.validation.constraints.NotNull;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import win.masteryyh.masteryyhsystem.base.page.PageDataRequest;
import win.masteryyh.masteryyhsystem.base.page.PagedResponse;
import win.masteryyh.masteryyhsystem.model.dto.AddAppPlatformDto;
import win.masteryyh.masteryyhsystem.model.dto.AppPlatformDto;
import win.masteryyh.masteryyhsystem.model.dto.UpdateAppPlatformDto;
import win.masteryyh.masteryyhsystem.model.dto.docker.DockerContainerDto;
import win.masteryyh.masteryyhsystem.model.dto.docker.DockerImageDto;
import win.masteryyh.masteryyhsystem.model.dto.docker.DockerNetworkDto;
import win.masteryyh.masteryyhsystem.model.dto.docker.DockerVolumeDto;
import win.masteryyh.masteryyhsystem.service.AppPlatformService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1/platforms")
public class AppPlatformController {
    private final AppPlatformService service;

    public AppPlatformController(AppPlatformService service) {
        this.service = service;
    }

    @GetMapping("/list")
    public PagedResponse<AppPlatformDto> page(@Validated PageDataRequest request) {
        return service.page(request);
    }

    @GetMapping("/info")
    public AppPlatformDto get(@RequestParam @NotNull(message = "ID cannot be null") UUID id) {
        return service.get(id);
    }

    @PostMapping("/add")
    public void add(@RequestBody @Validated AddAppPlatformDto data) {
        data.validate();
        service.add(data);
    }

    @PutMapping("/update/{id}")
    public void update(@PathVariable @NotNull(message = "ID cannot be null") UUID id,
                       @RequestBody @Validated UpdateAppPlatformDto data) {
        service.update(id, data);
    }

    @DeleteMapping("/delete/{id}")
    public void remove(@PathVariable @NotNull(message = "ID cannot be null") UUID id) {
        service.remove(id);
    }

    @GetMapping("/{id}/containers")
    public List<DockerContainerDto> containers(@PathVariable @NotNull(message = "ID cannot be null") UUID id) {
        return service.listContainers(id);
    }

    @GetMapping("/{id}/images")
    public List<DockerImageDto> images(@PathVariable @NotNull(message = "ID cannot be null") UUID id) {
        return service.listImages(id);
    }

    @GetMapping("/{id}/networks")
    public List<DockerNetworkDto> networks(@PathVariable @NotNull(message = "ID cannot be null") UUID id) {
        return service.listNetworks(id);
    }

    @GetMapping("/{id}/volumes")
    public List<DockerVolumeDto> volumes(@PathVariable @NotNull(message = "ID cannot be null") UUID id) {
        return service.listVolumes(id);
    }
}
