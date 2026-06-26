package win.masteryyh.masteryyhsystem.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import win.masteryyh.masteryyhsystem.model.dto.GatewayEntryPointDto;
import win.masteryyh.masteryyhsystem.model.dto.GatewayEntryPointRequest;
import win.masteryyh.masteryyhsystem.service.GatewayEntryPointService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1/gateways/{gatewayId}/entry-points")
public class GatewayEntryPointController {
    private final GatewayEntryPointService service;

    public GatewayEntryPointController(GatewayEntryPointService service) {
        this.service = service;
    }

    @GetMapping("/list")
    public List<GatewayEntryPointDto> list(@PathVariable UUID gatewayId) {
        return service.list(gatewayId);
    }

    @GetMapping("/info/{id}")
    public GatewayEntryPointDto get(@PathVariable UUID gatewayId, @PathVariable UUID id) {
        return service.get(gatewayId, id);
    }

    @PostMapping("/add")
    public void add(@PathVariable UUID gatewayId,
                    @RequestBody @Validated GatewayEntryPointRequest data) {
        service.add(gatewayId, data);
    }

    @PutMapping("/update/{id}")
    public void update(@PathVariable UUID gatewayId, @PathVariable UUID id,
                       @RequestBody @Validated GatewayEntryPointRequest data) {
        service.update(gatewayId, id, data);
    }

    @DeleteMapping("/delete/{id}")
    public void remove(@PathVariable UUID gatewayId, @PathVariable UUID id) {
        service.remove(gatewayId, id);
    }
}
