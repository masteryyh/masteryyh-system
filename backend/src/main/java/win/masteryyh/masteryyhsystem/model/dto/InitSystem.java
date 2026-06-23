package win.masteryyh.masteryyhsystem.model.dto;

/**
 * 主机（{@link PlatformType#HOST}）所使用的 init system 类型。
 * 用于在 {@code SSHManager} 中选择对应的探活命令，区分 systemd 与 OpenRC 等轻量化 init。
 */
public enum InitSystem {
    SYSTEMD,

    OPENRC,
}
