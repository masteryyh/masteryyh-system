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
import win.masteryyh.masteryyhsystem.model.dto.AddGatewayConfigDto;
import win.masteryyh.masteryyhsystem.model.dto.GatewayConfigDto;
import win.masteryyh.masteryyhsystem.model.dto.UpdateGatewayConfigDto;
import win.masteryyh.masteryyhsystem.service.GatewayService;
import win.masteryyh.masteryyhsystem.base.utils.NginxConfigCodec;
import win.masteryyh.masteryyhsystem.model.dto.NginxParseRequest;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/v1/gateways")
public class GatewayConfigController {
    private final GatewayService service;
    private final NginxConfigCodec nginxConfigCodec;

    public GatewayConfigController(GatewayService service, NginxConfigCodec nginxConfigCodec) {
        this.service = service;
        this.nginxConfigCodec = nginxConfigCodec;
    }

    @GetMapping("/list")
    public PagedResponse<GatewayConfigDto> page(@Validated PageDataRequest request) {
        return service.page(request);
    }

    @GetMapping("/info")
    public GatewayConfigDto get(@RequestParam @NotNull(message = "ID cannot be null") UUID id) {
        return service.get(id);
    }

    @PostMapping("/add")
    public void add(@RequestBody @Validated AddGatewayConfigDto data) {
        service.add(data);
    }

    @PutMapping("/update/{id}")
    public void update(@PathVariable @NotNull(message = "ID cannot be null") UUID id,
                       @RequestBody @Validated UpdateGatewayConfigDto data) {
        service.update(id, data);
    }

    @DeleteMapping("/delete/{id}")
    public void remove(@PathVariable @NotNull(message = "ID cannot be null") UUID id) {
        service.remove(id);
    }

    @PostMapping("/nginx/parse")
    public List<NginxConfigCodec.ParsedEntryPoint> parse(
            @RequestBody @Validated NginxParseRequest data) {
        return nginxConfigCodec.parse(data.configContent());
    }
}
