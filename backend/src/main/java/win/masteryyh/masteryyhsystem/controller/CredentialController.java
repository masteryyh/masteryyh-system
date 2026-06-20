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
import win.masteryyh.masteryyhsystem.model.dto.AddCredentialDto;
import win.masteryyh.masteryyhsystem.model.dto.CredentialDto;
import win.masteryyh.masteryyhsystem.model.dto.UpdateCredentialDto;
import win.masteryyh.masteryyhsystem.service.CredentialService;

import java.io.IOException;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.util.UUID;

@RestController
@RequestMapping("/v1/credentials")
public class CredentialController {
    private final CredentialService service;

    public CredentialController(CredentialService service) {
        this.service = service;
    }

    @GetMapping("/list")
    public PagedResponse<CredentialDto> page(@Validated PageDataRequest request) {
        return service.page(request);
    }

    @GetMapping("/info")
    public CredentialDto get(@RequestParam @NotNull(message = "ID cannot be null") UUID id) {
        return service.get(id);
    }

    @PostMapping("/add")
    public void add(@RequestBody @Validated AddCredentialDto data) throws IOException, NoSuchAlgorithmException, NoSuchProviderException {
        data.validate();
        service.add(data);
    }

    @PutMapping("/update/{id}")
    public void update(@PathVariable @NotNull(message = "ID cannot be null") UUID id,
                       @RequestBody @Validated UpdateCredentialDto data) {
        service.update(id, data);
    }

    @DeleteMapping("/delete/{id}")
    public void remove(@PathVariable UUID id) {
        service.remove(id);
    }
}
