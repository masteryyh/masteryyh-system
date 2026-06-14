package win.masteryyh.masteryyhsystem.service;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.base.utils.JwtUtils;
import win.masteryyh.masteryyhsystem.model.dto.LoginDto;
import win.masteryyh.masteryyhsystem.model.dto.LoginResponseDto;

@Service
public class LoginService {
    private final AuthenticationManager authenticationManager;

    private final JwtUtils jwtUtils;

    public LoginService(AuthenticationManager authenticationManager, JwtUtils jwtUtils) {
        this.authenticationManager = authenticationManager;
        this.jwtUtils = jwtUtils;
    }

    public LoginResponseDto login(LoginDto loginDto) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(loginDto.name(), loginDto.password())
            );
            String token = jwtUtils.generateToken(authentication.getName());
            return new LoginResponseDto(authentication.getName(), token);
        } catch (BadCredentialsException exception) {
            throw new BusinessException(401, "Invalid credential.");
        }
    }
}
