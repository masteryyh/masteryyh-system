import type { SSHKeyType } from "@/types/api";

const DISPLAY_TIME_ZONE = "Asia/Shanghai";

const DATE_TIME_WITHOUT_ZONE_PATTERN =
    /^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/;
const TIME_ZONE_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

const dateTimePartsFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
});

export function parseApiDate(value: string): Date {
    const trimmed = value.trim();
    if (TIME_ZONE_SUFFIX_PATTERN.test(trimmed)) {
        return new Date(trimmed);
    }

    const matched = DATE_TIME_WITHOUT_ZONE_PATTERN.exec(trimmed);
    if (!matched) {
        return new Date(trimmed);
    }

    const [, year, month, day, hour, minute, second = "0", fraction = "0"] =
        matched;
    const millisecond = Number(fraction.padEnd(3, "0").slice(0, 3));

    return new Date(
        Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
            millisecond,
        ),
    );
}

export function parseApiDateForPicker(value: string): Date {
    const parsed = parseApiDate(value);
    if (Number.isNaN(parsed.getTime())) {
        return parsed;
    }

    const parts = Object.fromEntries(
        dateTimePartsFormatter
            .formatToParts(parsed)
            .map((part) => [part.type, part.value]),
    );

    return new Date(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
        parsed.getMilliseconds(),
    );
}

export function formatDate(value: string): string {
    const date = parseApiDate(value);
    if (Number.isNaN(date.getTime())) return value;
    return dateTimeFormatter.format(date);
}

export function formatFingerprint(value: string): string {
    if (!/^[0-9a-f]{64}$/i.test(value)) return value;
    return value.match(/.{2}/g)?.join(":") ?? value;
}

/**
 * 把后端各路（BouncyCastle SSH wire format / JCA / OpenSSL / OpenSSH）的曲线名归一为
 * 行业最常见的展示名：
 *
 *   nistp256 / secp256r1 / prime256v1 / P-256   → NIST P-256
 *   nistp384 / secp384r1                         → NIST P-384
 *   nistp521 / secp521r1                         → NIST P-521
 *   Ed25519 / X25519 / Curve25519                → Curve25519
 *   Ed448   / X448   / Curve448                  → Curve448
 *
 * 命中不到的曲线原样返回，避免遮蔽冷门或新出现的曲线。
 */
export function formatCurveName(
    value: string | null | undefined,
): string | null {
    if (!value) return null;
    const key = value.trim().toLowerCase();
    switch (key) {
        case "nistp256":
        case "secp256r1":
        case "prime256v1":
        case "p-256":
        case "p256":
            return "NIST P-256";
        case "nistp384":
        case "secp384r1":
        case "prime384v1":
        case "p-384":
        case "p384":
            return "NIST P-384";
        case "nistp521":
        case "secp521r1":
        case "prime521v1":
        case "p-521":
        case "p521":
            return "NIST P-521";
        case "secp256k1":
            return "secp256k1";
        case "ed25519":
        case "x25519":
        case "curve25519":
            return "Curve25519";
        case "ed448":
        case "x448":
        case "curve448":
            return "Curve448";
        default:
            return value;
    }
}

/**
 * 把 SSH 私/公钥的算法枚举值（`RSA / DSA / ECDSA / ED25519`）转成业内常用拼写。
 */
export function formatSshKeyType(value: SSHKeyType): string {
    switch (value) {
        case "ED25519":
            return "Ed25519";
        case "ECDSA":
            return "ECDSA";
        case "RSA":
            return "RSA";
        case "DSA":
            return "DSA";
        default:
            return value;
    }
}

/**
 * 把 X.509 证书的 JCA `publicKey.getAlgorithm()` 值（`RSA / EC / DSA / Ed25519 / Ed448`）
 * 转成业内常用拼写。Java 的 `EC` 在 PKIX 圈一律读作 ECDSA。
 */
export function formatPublicKeyAlgorithm(value: string): string {
    const key = value.trim();
    switch (key) {
        case "EC":
        case "ECDSA":
            return "ECDSA";
        case "Ed25519":
        case "EdDSA":
            return "Ed25519";
        case "Ed448":
            return "Ed448";
        case "RSA":
            return "RSA";
        case "DSA":
            return "DSA";
        default:
            return value;
    }
}
