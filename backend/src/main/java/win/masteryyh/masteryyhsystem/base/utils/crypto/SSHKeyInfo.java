package win.masteryyh.masteryyhsystem.base.utils.crypto;

import java.io.Serializable;

public record SSHKeyInfo(SSHKeyType keyType,
                         int bitLength,
                         String curveName,
                         String fingerprint) implements Serializable {
}
