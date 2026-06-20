package win.masteryyh.masteryyhsystem.base.utils.crypto;

import com.hierynomus.sshj.userauth.keyprovider.OpenSSHKeyV1KeyFile;
import io.micrometer.common.util.StringUtils;
import net.schmizz.sshj.userauth.password.PasswordFinder;
import net.schmizz.sshj.userauth.password.PasswordUtils;
import org.bouncycastle.crypto.params.AsymmetricKeyParameter;
import org.bouncycastle.crypto.params.DSAParameters;
import org.bouncycastle.crypto.params.DSAPrivateKeyParameters;
import org.bouncycastle.crypto.params.DSAPublicKeyParameters;
import org.bouncycastle.crypto.params.ECPrivateKeyParameters;
import org.bouncycastle.crypto.params.ECPublicKeyParameters;
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters;
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters;
import org.bouncycastle.crypto.params.RSAKeyParameters;
import org.bouncycastle.crypto.params.RSAPrivateCrtKeyParameters;
import org.bouncycastle.crypto.util.OpenSSHPrivateKeyUtil;
import org.bouncycastle.crypto.util.OpenSSHPublicKeyUtil;
import org.bouncycastle.crypto.util.PrivateKeyFactory;
import org.bouncycastle.crypto.util.SSHNamedCurves;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.math.ec.ECPoint;
import org.bouncycastle.util.encoders.Base64;
import org.bouncycastle.util.io.pem.PemObject;
import org.bouncycastle.util.io.pem.PemReader;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;

import java.io.IOException;
import java.io.StringReader;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.PrivateKey;
import java.security.Security;
import java.util.Arrays;
import java.util.Objects;

public class CryptoUtils {
    static {
        if (Security.getProvider("BC") == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    private static final byte[] AUTH_MAGIC =
            "openssh-key-v1\0".getBytes(StandardCharsets.US_ASCII);

    private static byte[] readBytes(ByteBuffer buffer) {
        if (buffer.remaining() < Integer.BYTES) {
            return null;
        }

        int length = buffer.getInt();
        if (length < 0 || length > buffer.remaining()) {
            return null;
        }

        byte[] bytes = new byte[length];
        buffer.get(bytes);
        return bytes;
    }

    private static String readString(ByteBuffer buffer) {
        byte[] bytes = readBytes(buffer);
        if (bytes == null) {
            return null;
        }
        return new String(bytes, StandardCharsets.US_ASCII);
    }

    private static boolean isProtected(byte[] content) {
        ByteBuffer buffer = ByteBuffer.wrap(content);
        if (buffer.remaining() < AUTH_MAGIC.length) {
            throw new BusinessException(400, "Invalid SSH private key format");
        }

        byte[] magic = new byte[AUTH_MAGIC.length];
        buffer.get(magic);
        if (!Arrays.equals(magic, AUTH_MAGIC)) {
            throw new BusinessException(400, "Invalid SSH private key format");
        }

        String cipherName = readString(buffer);
        if (cipherName == null) {
            throw new BusinessException(400, "Invalid SSH private key format");
        }

        String kdfName = readString(buffer);
        if (kdfName == null) {
            throw new BusinessException(400, "Invalid SSH private key format");
        }

        byte[] kdfOptions = readBytes(buffer);
        if (kdfOptions == null) {
            throw new BusinessException(400, "Invalid SSH private key format");
        }

        if ("none".equals(cipherName)) {
            if (!"none".equals(kdfName) || kdfOptions.length != 0) {
                throw new BusinessException(400, "Invalid SSH private key format");
            }
            return false;
        }

        if ("none".equals(kdfName)) {
            throw new BusinessException(400, "Invalid SSH private key format");
        }
        return true;
    }

    public static AsymmetricKeyParameter parseSSHPrivateKey(String key, String passphrase) throws IOException {
        try (StringReader reader = new StringReader(key)) {
            PemReader pemReader = new PemReader(reader);
            PemObject pemObject = pemReader.readPemObject();

            if (pemObject == null || !pemObject.getType().equals("OPENSSH PRIVATE KEY")) {
                throw new BusinessException(400, "Invalid SSH private key format");
            }

            if (!isProtected(pemObject.getContent())) {
                return OpenSSHPrivateKeyUtil.parsePrivateKeyBlob(pemObject.getContent());
            }

            if (StringUtils.isEmpty(passphrase)) {
                throw new BusinessException(400, "No passphrase provided");
            }

            PasswordFinder passwordFinder =
                    PasswordUtils.createOneOff(passphrase.toCharArray());
            OpenSSHKeyV1KeyFile keyFile = new OpenSSHKeyV1KeyFile();
            keyFile.init(key, null, passwordFinder);

            PrivateKey privateKey;
            try {
                privateKey = keyFile.getPrivate();
            } catch (Exception e) {
                throw new BusinessException(400, "Invalid SSH private key or passphrase");
            }
            return PrivateKeyFactory.createKey(privateKey.getEncoded());
        }
    }

    public static AsymmetricKeyParameter parseSSHPublicKey(String key) {
        String keyPart = key.split(" ")[1];
        byte[] decoded = Base64.decode(keyPart);
        return OpenSSHPublicKeyUtil.parsePublicKey(decoded);
    }

    public static String getFingerprint(AsymmetricKeyParameter publicKey) throws NoSuchAlgorithmException, NoSuchProviderException, IOException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256", "BC");

        byte[] encoded = OpenSSHPublicKeyUtil.encodePublicKey(publicKey);
        byte[] hash = digest.digest(encoded);
        return Base64.toBase64String(hash);
    }

    public static SSHKeyInfo resolveKeyInfo(AsymmetricKeyParameter keyParameter, boolean isPublic) throws NoSuchAlgorithmException, IOException, NoSuchProviderException {
        if (isPublic) {
            return switch (keyParameter) {
                case RSAKeyParameters rsa ->
                        new SSHKeyInfo(SSHKeyType.RSA, rsa.getModulus().bitLength(), null, getFingerprint(rsa));
                case DSAPublicKeyParameters dsa ->
                        new SSHKeyInfo(SSHKeyType.DSA, dsa.getParameters().getP().bitLength(), null, getFingerprint(dsa));
                case ECPublicKeyParameters ec ->
                        new SSHKeyInfo(SSHKeyType.ECDSA, ec.getParameters().getCurve().getFieldSize(),
                                SSHNamedCurves.getNameForParameters(ec.getParameters()), getFingerprint(ec));
                case Ed25519PublicKeyParameters ed25519 ->
                        new SSHKeyInfo(SSHKeyType.ED25519, Ed25519PublicKeyParameters.KEY_SIZE * Byte.SIZE,
                                "Ed25519", getFingerprint(ed25519));
                default -> null;
            };
        }

        return switch (keyParameter) {
            case RSAPrivateCrtKeyParameters rsaKeyParameters -> {
                RSAKeyParameters publicKey = new RSAKeyParameters(false, rsaKeyParameters.getModulus(),
                        rsaKeyParameters.getPublicExponent());
                yield new SSHKeyInfo(SSHKeyType.RSA,
                        publicKey.getModulus().bitLength(), null, getFingerprint(publicKey));
            }
            case DSAPrivateKeyParameters dsaKeyParameters -> {
                DSAParameters dsaParameters = dsaKeyParameters.getParameters();
                BigInteger y = dsaParameters.getG().modPow(dsaParameters.getQ(), dsaParameters.getP());

                DSAPublicKeyParameters publicKey = new DSAPublicKeyParameters(y, dsaParameters);
                yield new SSHKeyInfo(SSHKeyType.DSA,
                        dsaParameters.getP().bitLength(), null, getFingerprint(publicKey));
            }
            case ECPrivateKeyParameters ecParameters -> {
                ECPoint q = ecParameters.getParameters().getG()
                        .multiply(ecParameters.getD()).normalize();
                ECPublicKeyParameters publicKey = new ECPublicKeyParameters(q, ecParameters.getParameters());
                yield new SSHKeyInfo(SSHKeyType.ECDSA, ecParameters.getParameters().getCurve().getFieldSize(),
                        SSHNamedCurves.getNameForParameters(ecParameters.getParameters()), getFingerprint(publicKey));
            }
            case Ed25519PrivateKeyParameters ed25519Parameters -> {
                Ed25519PublicKeyParameters publicKey = ed25519Parameters.generatePublicKey();
                yield new SSHKeyInfo(SSHKeyType.ED25519, Ed25519PublicKeyParameters.KEY_SIZE * Byte.SIZE,
                        "Ed25519", getFingerprint(publicKey));
            }
            default -> null;
        };
    }

    public static String resolveSSHPublicKeyHeader(byte[] publicKey) throws NoSuchAlgorithmException, IOException, NoSuchProviderException {
        AsymmetricKeyParameter keyParameter = OpenSSHPublicKeyUtil.parsePublicKey(publicKey);
        SSHKeyInfo keyInfo = resolveKeyInfo(keyParameter, true);
        return switch (Objects.requireNonNull(keyInfo).keyType()) {
            case RSA -> "ssh-rsa";
            case DSA -> "ssh-dss";
            case ED25519 -> "ssh-ed25519";
            case ECDSA -> switch (keyInfo.curveName()) {
                case "secp256r1" -> "ecdsa-sha2-nistp256";
                case "secp384r1" -> "ecdsa-sha2-nistp384";
                case "secp521r1" -> "ecdsa-sha2-nistp521";
                default -> null;
            };
        };
    }
}
