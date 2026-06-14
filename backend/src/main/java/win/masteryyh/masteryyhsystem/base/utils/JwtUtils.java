package win.masteryyh.masteryyhsystem.base.utils;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.Getter;
import org.springframework.stereotype.Component;
import win.masteryyh.masteryyhsystem.base.config.SystemConfiguration;

import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Component
public class JwtUtils {
    private static final Duration TOKEN_TTL = Duration.ofDays(1);

    private final byte[] secret;

    @Getter
    private final long expiresInSeconds = TOKEN_TTL.toSeconds();

    public JwtUtils(SystemConfiguration systemConfiguration) {
        String jwtSecret = systemConfiguration.getJwtSecret();
        if (jwtSecret == null || jwtSecret.length() < 32) {
            throw new IllegalStateException("system.jwt-secret must be at least 32 characters long");
        }
        this.secret = jwtSecret.getBytes(StandardCharsets.UTF_8);
    }

    public String generateToken(String username) {
        Instant now = Instant.now();
        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                .subject(username)
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plus(TOKEN_TTL)))
                .build();

        SignedJWT signedJWT = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claimsSet);
        try {
            signedJWT.sign(new MACSigner(secret));
            return signedJWT.serialize();
        } catch (JOSEException exception) {
            throw new IllegalStateException("Failed to sign JWT", exception);
        }
    }

    public JWTClaimsSet validateToken(String token) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            if (!signedJWT.verify(new MACVerifier(secret))) {
                throw new IllegalArgumentException("Invalid JWT signature");
            }

            JWTClaimsSet claimsSet = signedJWT.getJWTClaimsSet();
            Date expirationTime = claimsSet.getExpirationTime();
            if (expirationTime == null || expirationTime.before(new Date())) {
                throw new IllegalArgumentException("JWT has expired");
            }
            return claimsSet;
        } catch (ParseException | JOSEException exception) {
            throw new IllegalArgumentException("Invalid JWT token", exception);
        }
    }
}
