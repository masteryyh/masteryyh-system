package win.masteryyh.masteryyhsystem.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
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
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.Type;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.generator.EventType;
import org.hibernate.proxy.HibernateProxy;
import org.hibernate.type.SqlTypes;
import win.masteryyh.masteryyhsystem.base.utils.crypto.CertificateInfo;
import win.masteryyh.masteryyhsystem.base.utils.crypto.SSHKeyInfo;
import win.masteryyh.masteryyhsystem.model.dto.CredentialStatus;
import win.masteryyh.masteryyhsystem.model.dto.CredentialType;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "credentials")
@Getter
@Setter
@ToString
@RequiredArgsConstructor
@SQLDelete(sql = "UPDATE credentials SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
public class Credential {
    @Id
    @Generated(event = EventType.INSERT)
    @Column(name = "id", updatable = false, columnDefinition = "uuid default uuidv7()")
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    @Column(name = "credential_type", updatable = false, nullable = false)
    @Enumerated(EnumType.STRING)
    private CredentialType credentialType;

    @Column(name = "ssh_private_key", updatable = false, columnDefinition = "text")
    private String sshPrivateKey;

    @Column(name = "ssh_private_key_passphrase", updatable = false)
    private String sshPrivateKeyPassphrase;

    @Column(name = "ssh_public_key", updatable = false, columnDefinition = "text")
    private String sshPublicKey;

    @Column(name = "ssh_key_info", columnDefinition = "jsonb", updatable = false)
    @Type(JsonBinaryType.class)
    @JdbcTypeCode(SqlTypes.JSON)
    private SSHKeyInfo sshKeyInfo;

    @Column(name = "text_password")
    private String textPassword;

    @Column(name = "certificate", updatable = false, columnDefinition = "text")
    private String certificate;

    @Column(name = "certificate_private_key", updatable = false, columnDefinition = "text")
    private String certificatePrivateKey;

    @Column(name = "certificate_private_key_passphrase", updatable = false)
    private String certificatePrivateKeyPassphrase;

    @Column(name = "certificate_info", columnDefinition = "jsonb", updatable = false)
    @Type(JsonBinaryType.class)
    @JdbcTypeCode(SqlTypes.JSON)
    private CertificateInfo certificateInfo;

    @Column(name = "expires_at", columnDefinition = "timestamp")
    private LocalDateTime expiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, columnDefinition = "varchar(32) not null default 'ACTIVE'")
    private CredentialStatus status;

    @CreationTimestamp
    @Column(name = "created_at", columnDefinition = "timestamp not null default current_timestamp")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", columnDefinition = "timestamp not null default current_timestamp")
    private LocalDateTime updatedAt;

    @JsonIgnore
    @Column(name = "deleted_at", columnDefinition = "timestamp")
    private LocalDateTime deletedAt;

    @Override
    public final boolean equals(Object o) {
        if (this == o) return true;
        if (o == null) return false;
        Class<?> oEffectiveClass = o instanceof HibernateProxy ? ((HibernateProxy) o).getHibernateLazyInitializer().getPersistentClass() : o.getClass();
        Class<?> thisEffectiveClass = this instanceof HibernateProxy ? ((HibernateProxy) this).getHibernateLazyInitializer().getPersistentClass() : this.getClass();
        if (thisEffectiveClass != oEffectiveClass) return false;
        Credential that = (Credential) o;
        return getId() != null && Objects.equals(getId(), that.getId());
    }

    @Override
    public final int hashCode() {
        return this instanceof HibernateProxy ? ((HibernateProxy) this).getHibernateLazyInitializer().getPersistentClass().hashCode() : getClass().hashCode();
    }
}
