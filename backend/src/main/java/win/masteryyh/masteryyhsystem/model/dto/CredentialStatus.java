package win.masteryyh.masteryyhsystem.model.dto;

/**
 * 凭据生命周期状态。
 *
 * 优先级（高 -> 低）：EXPIRED -> EXPIRING_SOON -> IN_USE -> ACTIVE。
 * 过期/即将过期是必须立刻看到的信号，覆盖在用 / 空闲两种"健康"语义。
 */
public enum CredentialStatus {
    /** 凭据未过期且未被任何 App Platform 引用。 */
    ACTIVE,

    /** 凭据未过期且至少被一个 App Platform 引用。 */
    IN_USE,

    /** 凭据未过期，但距离过期不足配置的阈值（默认 30 天）。 */
    EXPIRING_SOON,

    /** 凭据的 expiresAt 已早于当前时间。 */
    EXPIRED,
}
