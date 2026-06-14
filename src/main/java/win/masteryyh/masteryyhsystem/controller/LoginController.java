package win.masteryyh.masteryyhsystem.controller;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import win.masteryyh.masteryyhsystem.model.dto.LoginDto;
import win.masteryyh.masteryyhsystem.model.dto.LoginResponseDto;
import win.masteryyh.masteryyhsystem.service.LoginService;

@RestController
@RequestMapping("/v1/user")
public class LoginController {
    private final LoginService loginService;

    public LoginController(LoginService loginService) {
        this.loginService = loginService;
    }

    @PostMapping("/login")
    public LoginResponseDto login(@Valid @RequestBody LoginDto data) {
        return loginService.login(data);
    }
}
