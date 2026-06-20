package win.masteryyh.masteryyhsystem.base.consts;

import java.util.regex.Pattern;

public class GenericConsts {
    public static final Pattern OPENSSH_PRIVATE_KEY = Pattern.compile(
            "\\A-----BEGIN OPENSSH PRIVATE KEY-----\\R" +
                    "([A-Za-z0-9+/=\\r\\n]+)" +
                    "-----END OPENSSH PRIVATE KEY-----\\R?\\z"
    );

    public static final Pattern OPENSSH_PUBLIC_KEY = Pattern.compile(
            "\\A(?:ssh-(?:rsa|ed25519|dss)"
                    + "|ecdsa-sha2-nistp(?:256|384|521)"
                    + "|sk-ssh-ed25519@openssh\\.com"
                    + "|sk-ecdsa-sha2-nistp256@openssh\\.com)"
                    + "[\\t ]+"
                    + "(?:[A-Za-z0-9+/]{4})+"
                    + "(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?"
                    + "(?:[\\t ]+[^\\r\\n]*)?"
                    + "\\z"
    );
}
