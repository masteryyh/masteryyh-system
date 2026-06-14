package win.masteryyh.masteryyhsystem.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;
import org.hibernate.proxy.HibernateProxy;
import org.springframework.data.annotation.CreatedDate;
import win.masteryyh.masteryyhsystem.model.dto.DeployType;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "gateway_config")
@Getter
@Setter
@ToString
@RequiredArgsConstructor
public class GatewayConfig {
    @Id
    @Generated(event = EventType.INSERT)
    @Column(updatable = false, columnDefinition = "uuid default uuidv7()")
    private UUID id;

    @Column(name = "deploy_type", nullable = false)
    @Enumerated(EnumType.STRING)
    private DeployType deployType;

    @Column(name = "docker_host")
    private String dockerHost;

    @Column(name = "docker_port")
    private Integer dockerPort;

    @Column(name = "container_id")
    private String containerId;

    @Column(name = "container_name")
    private String containerName;

    @Column(name = "container_image")
    private String containerImage;

    @Column(name = "systemd_service_name")
    private String systemdServiceName;

    @Column(name = "local_config_path")
    private String localConfigPath;

    @Column(name = "container_config_path")
    private String containerConfigPath;

    @CreatedDate
    @Column(name = "created_at", columnDefinition = "timestamp not null default now()")
    private LocalDateTime createdAt;

    @Column(name = "deleted_at", columnDefinition = "timestamp")
    private LocalDateTime deletedAt;

    @Override
    public final boolean equals(Object o) {
        if (this == o) return true;
        if (o == null) return false;
        Class<?> oEffectiveClass = o instanceof HibernateProxy ? ((HibernateProxy) o).getHibernateLazyInitializer().getPersistentClass() : o.getClass();
        Class<?> thisEffectiveClass = this instanceof HibernateProxy ? ((HibernateProxy) this).getHibernateLazyInitializer().getPersistentClass() : this.getClass();
        if (thisEffectiveClass != oEffectiveClass) return false;
        GatewayConfig that = (GatewayConfig) o;
        return getId() != null && Objects.equals(getId(), that.getId());
    }

    @Override
    public final int hashCode() {
        return this instanceof HibernateProxy ? ((HibernateProxy) this).getHibernateLazyInitializer().getPersistentClass().hashCode() : getClass().hashCode();
    }
}
