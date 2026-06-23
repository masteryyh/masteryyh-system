package win.masteryyh.masteryyhsystem.base.utils.crypto;

import com.hierynomus.sshj.userauth.keyprovider.OpenSSHKeyV1KeyFile;
import io.micrometer.common.util.StringUtils;
import net.schmizz.sshj.userauth.password.PasswordFinder;
import net.schmizz.sshj.userauth.password.PasswordUtils;
import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.asn1.x500.RDN;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x500.style.BCStyle;
import org.bouncycastle.asn1.x500.style.IETFUtils;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter;
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
import org.bouncycastle.openssl.PEMDecryptorProvider;
import org.bouncycastle.openssl.PEMEncryptedKeyPair;
import org.bouncycastle.openssl.PEMKeyPair;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.bouncycastle.openssl.jcajce.JceOpenSSLPKCS8DecryptorProviderBuilder;
import org.bouncycastle.openssl.jcajce.JcePEMDecryptorProviderBuilder;
import org.bouncycastle.operator.InputDecryptorProvider;
import org.bouncycastle.pkcs.PKCS8EncryptedPrivateKeyInfo;
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
import java.security.PublicKey;
import java.security.Security;
import java.security.Signature;
import java.security.cert.X509Certificate;
import java.security.interfaces.DSAPublicKey;
import java.security.interfaces.ECPublicKey;
import java.security.interfaces.RSAPublicKey;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HexFormat;
import java.util.List;
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
            throw new BusinessException(400, "error.credential.sshPrivateKey.invalidFormat",
                    "Invalid SSH private key format");
        }

        byte[] magic = new byte[AUTH_MAGIC.length];
        buffer.get(magic);
        if (!Arrays.equals(magic, AUTH_MAGIC)) {
            throw new BusinessException(400, "error.credential.sshPrivateKey.invalidFormat",
                    "Invalid SSH private key format");
        }

        String cipherName = readString(buffer);
        if (cipherName == null) {
            throw new BusinessException(400, "error.credential.sshPrivateKey.invalidFormat",
                    "Invalid SSH private key format");
        }

        String kdfName = readString(buffer);
        if (kdfName == null) {
            throw new BusinessException(400, "error.credential.sshPrivateKey.invalidFormat",
                    "Invalid SSH private key format");
        }

        byte[] kdfOptions = readBytes(buffer);
        if (kdfOptions == null) {
            throw new BusinessException(400, "error.credential.sshPrivateKey.invalidFormat",
                    "Invalid SSH private key format");
        }

        if ("none".equals(cipherName)) {
            if (!"none".equals(kdfName) || kdfOptions.length != 0) {
                throw new BusinessException(400, "error.credential.sshPrivateKey.invalidFormat",
                        "Invalid SSH private key format");
            }
            return false;
        }

        if ("none".equals(kdfName)) {
            throw new BusinessException(400, "error.credential.sshPrivateKey.invalidFormat",
                    "Invalid SSH private key format");
        }
        return true;
    }

    public static AsymmetricKeyParameter parseSSHPrivateKey(String key, String passphrase) throws IOException {
        try (StringReader reader = new StringReader(key)) {
            PemReader pemReader = new PemReader(reader);
            PemObject pemObject = pemReader.readPemObject();

            if (pemObject == null || !pemObject.getType().equals("OPENSSH PRIVATE KEY")) {
                throw new BusinessException(400, "error.credential.sshPrivateKey.invalidFormat",
                        "Invalid SSH private key format");
            }

            if (!isProtected(pemObject.getContent())) {
                return OpenSSHPrivateKeyUtil.parsePrivateKeyBlob(pemObject.getContent());
            }

            if (StringUtils.isEmpty(passphrase)) {
                throw new BusinessException(400, "error.credential.sshPrivateKey.noPassphrase",
                        "No passphrase provided");
            }

            PasswordFinder passwordFinder =
                    PasswordUtils.createOneOff(passphrase.toCharArray());
            OpenSSHKeyV1KeyFile keyFile = new OpenSSHKeyV1KeyFile();
            keyFile.init(key, null, passwordFinder);

            PrivateKey privateKey;
            try {
                privateKey = keyFile.getPrivate();
            } catch (Exception e) {
                throw new BusinessException(400, "error.credential.sshPrivateKey.invalidOrPassphrase",
                        "Invalid SSH private key or passphrase");
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
        return HexFormat.of().formatHex(hash);
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

    public static List<X509Certificate> parseCertificateChain(String pem) {
        if (StringUtils.isEmpty(pem)) {
            throw new BusinessException(400, "error.credential.certificate.empty",
                    "Certificate cannot be empty");
        }

        List<X509Certificate> chain = new ArrayList<>();
        JcaX509CertificateConverter converter =
                new JcaX509CertificateConverter().setProvider("BC");
        try (PEMParser parser = new PEMParser(new StringReader(pem))) {
            Object object;
            while ((object = parser.readObject()) != null) {
                if (object instanceof X509CertificateHolder holder) {
                    chain.add(converter.getCertificate(holder));
                } else {
                    throw new BusinessException(400, "error.credential.certificate.invalid",
                            "Certificate PEM contains a non-certificate object");
                }
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(400, "error.credential.certificate.parseError",
                    "Failed to parse certificate: " + e.getMessage());
        }

        if (chain.isEmpty()) {
            throw new BusinessException(400, "error.credential.certificate.invalid",
                    "No certificate found in PEM");
        }
        return chain;
    }

    public static PrivateKey parseCertificatePrivateKey(String pem, String passphrase) {
        if (StringUtils.isEmpty(pem)) {
            throw new BusinessException(400, "error.credential.certificate.invalidPrivateKey",
                    "Private key cannot be empty");
        }

        JcaPEMKeyConverter converter = new JcaPEMKeyConverter().setProvider("BC");
        try (PEMParser parser = new PEMParser(new StringReader(pem))) {
            Object object = parser.readObject();
            if (object == null) {
                throw new BusinessException(400, "error.credential.certificate.invalidPrivateKey",
                        "Private key PEM is empty or malformed");
            }

            return switch (object) {
                case PEMEncryptedKeyPair encrypted -> {
                    if (StringUtils.isEmpty(passphrase)) {
                        throw new BusinessException(400, "error.credential.certificate.noPassphrase",
                                "Private key is encrypted, passphrase required");
                    }
                    PEMDecryptorProvider decryptor = new JcePEMDecryptorProviderBuilder()
                            .build(passphrase.toCharArray());
                    try {
                        PEMKeyPair decrypted = encrypted.decryptKeyPair(decryptor);
                        yield converter.getKeyPair(decrypted).getPrivate();
                    } catch (Exception e) {
                        throw new BusinessException(400, "error.credential.certificate.invalidOrPassphrase",
                                "Invalid private key or passphrase");
                    }
                }
                case PKCS8EncryptedPrivateKeyInfo encryptedPkcs8 -> {
                    if (StringUtils.isEmpty(passphrase)) {
                        throw new BusinessException(400, "error.credential.certificate.noPassphrase",
                                "Private key is encrypted, passphrase required");
                    }
                    InputDecryptorProvider decryptor = new JceOpenSSLPKCS8DecryptorProviderBuilder()
                            .setProvider("BC")
                            .build(passphrase.toCharArray());
                    try {
                        PrivateKeyInfo info = encryptedPkcs8.decryptPrivateKeyInfo(decryptor);
                        yield converter.getPrivateKey(info);
                    } catch (Exception e) {
                        throw new BusinessException(400, "error.credential.certificate.invalidOrPassphrase",
                                "Invalid private key or passphrase");
                    }
                }
                case PrivateKeyInfo info -> converter.getPrivateKey(info);
                case PEMKeyPair pair -> converter.getKeyPair(pair).getPrivate();
                default -> throw new BusinessException(400, "error.credential.certificate.invalidPrivateKey",
                        "Unsupported private key format: " + object.getClass().getSimpleName());
            };
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(400, "error.credential.certificate.invalidPrivateKey",
                    "Failed to parse private key: " + e.getMessage());
        }
    }

    public static void validateCertificateAndPrivateKey(X509Certificate certificate, PrivateKey privateKey) {
        PublicKey publicKey = certificate.getPublicKey();
        if (!Objects.equals(publicKey.getAlgorithm(), privateKey.getAlgorithm())) {
            throw new BusinessException(400, "error.credential.certificate.mismatch",
                    "Certificate public key algorithm does not match private key");
        }

        if (publicKey instanceof RSAPublicKey rsaPublic
                && privateKey instanceof java.security.interfaces.RSAPrivateKey rsaPrivate) {
            if (!rsaPublic.getModulus().equals(rsaPrivate.getModulus())) {
                throw new BusinessException(400, "error.credential.certificate.mismatch",
                        "Certificate public key does not match the provided private key");
            }
            return;
        }

        String signatureAlgorithm = switch (privateKey.getAlgorithm()) {
            case "EC" -> "SHA256withECDSA";
            case "DSA" -> "SHA256withDSA";
            case "EdDSA", "Ed25519" -> "Ed25519";
            case "Ed448" -> "Ed448";
            default -> "SHA256with" + privateKey.getAlgorithm();
        };

        try {
            byte[] challenge = "cHeCkThIsOuT!!!123".getBytes(StandardCharsets.UTF_8);
            Signature signer = Signature.getInstance(signatureAlgorithm, "BC");
            signer.initSign(privateKey);
            signer.update(challenge);
            byte[] signature = signer.sign();

            Signature verifier = Signature.getInstance(signatureAlgorithm, "BC");
            verifier.initVerify(publicKey);
            verifier.update(challenge);
            if (!verifier.verify(signature)) {
                throw new BusinessException(400, "error.credential.certificate.mismatch",
                        "Certificate public key does not match the provided private key");
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(400, "error.credential.certificate.mismatch",
                    "Failed to verify certificate/key pair: " + e.getMessage());
        }
    }

    public static CertificateInfo resolveCertificateInfo(X509Certificate certificate) {
        try {
            X500Name subject = new X500Name(certificate.getSubjectX500Principal().getName());
            X500Name issuer = new X500Name(certificate.getIssuerX500Principal().getName());

            PublicKey publicKey = certificate.getPublicKey();
            int bitLength = switch (publicKey) {
                case RSAPublicKey rsa -> rsa.getModulus().bitLength();
                case ECPublicKey ec -> ec.getParams().getOrder().bitLength();
                case DSAPublicKey dsa -> dsa.getParams().getP().bitLength();
                default -> -1;
            };

            List<String> sans = new ArrayList<>();
            Collection<List<?>> sanEntries = certificate.getSubjectAlternativeNames();
            if (sanEntries != null) {
                for (List<?> entry : sanEntries) {
                    if (entry.size() >= 2 && entry.get(1) instanceof String value) {
                        sans.add(value);
                    }
                }
            }

            boolean selfSigned;
            try {
                certificate.verify(publicKey);
                selfSigned = certificate.getSubjectX500Principal()
                        .equals(certificate.getIssuerX500Principal());
            } catch (Exception ignored) {
                selfSigned = false;
            }

            return new CertificateInfo(
                    firstCnOrDn(subject),
                    subject.toString(),
                    firstCnOrDn(issuer),
                    issuer.toString(),
                    certificate.getSerialNumber().toString(16),
                    certificate.getSigAlgName(),
                    publicKey.getAlgorithm(),
                    bitLength,
                    certificate.getNotBefore().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                    certificate.getNotAfter().toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime(),
                    certificateFingerprintSha256(certificate),
                    sans,
                    selfSigned
            );
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(500, "error.credential.certificate.parseError",
                    "Failed to resolve certificate info: " + e.getMessage());
        }
    }

    public static String certificateFingerprintSha256(X509Certificate certificate) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256", "BC");
            byte[] hash = digest.digest(certificate.getEncoded());
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new BusinessException(500, "error.credential.certificate.parseError",
                    "Failed to compute certificate fingerprint: " + e.getMessage());
        }
    }

    private static String firstCnOrDn(X500Name name) {
        RDN[] cnRdns = name.getRDNs(BCStyle.CN);
        if (cnRdns != null && cnRdns.length > 0) {
            return IETFUtils.valueToString(cnRdns[0].getFirst().getValue());
        }
        return name.toString();
    }
}
