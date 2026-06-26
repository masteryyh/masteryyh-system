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
import win.masteryyh.masteryyhsystem.model.dto.GatewayRouteDto;
import win.masteryyh.masteryyhsystem.model.dto.GatewayRouteRequestDto;
import win.masteryyh.masteryyhsystem.service.GatewayRouteService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1/gateways/{gatewayId}/entry-points/{entryPointId}/routes")
public class GatewayRouteController {
    private final GatewayRouteService service;

    public GatewayRouteController(GatewayRouteService service) {
        this.service = service;
    }

    @GetMapping("/list")
    public List<GatewayRouteDto> list(@PathVariable UUID gatewayId,
                                      @PathVariable UUID entryPointId) {
        return service.list(gatewayId, entryPointId);
    }

    @GetMapping("/info/{id}")
    public GatewayRouteDto get(@PathVariable UUID gatewayId,
                               @PathVariable UUID entryPointId,
                               @PathVariable UUID id) {
        return service.get(gatewayId, entryPointId, id);
    }

    @PostMapping("/add")
    public void add(@PathVariable UUID gatewayId,
                    @PathVariable UUID entryPointId,
                    @RequestBody @Validated GatewayRouteRequestDto data) {
        service.add(gatewayId, entryPointId, data);
    }

    @PutMapping("/update/{id}")
    public void update(@PathVariable UUID gatewayId,
                       @PathVariable UUID entryPointId,
                       @PathVariable UUID id,
                       @RequestBody @Validated GatewayRouteRequestDto data) {
        service.update(gatewayId, entryPointId, id, data);
    }

    @DeleteMapping("/delete/{id}")
    public void remove(@PathVariable UUID gatewayId,
                       @PathVariable UUID entryPointId,
                       @PathVariable UUID id) {
        service.remove(gatewayId, entryPointId, id);
    }
}
