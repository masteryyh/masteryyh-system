package win.masteryyh.masteryyhsystem.base.utils.crypto;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

public record CertificateInfo(String subject,
                              String subjectDn,
                              String issuer,
                              String issuerDn,
                              String serialNumber,
                              String signatureAlgorithm,
                              String publicKeyAlgorithm,
                              int publicKeyBitLength,
                              LocalDateTime notBefore,
                              LocalDateTime notAfter,
                              String fingerprintSha256,
                              List<String> sans,
                              boolean selfSigned) implements Serializable {
}
