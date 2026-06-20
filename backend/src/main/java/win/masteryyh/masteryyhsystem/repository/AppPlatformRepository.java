package win.masteryyh.masteryyhsystem.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import win.masteryyh.masteryyhsystem.model.AppPlatform;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppPlatformRepository extends
        JpaRepository<AppPlatform, UUID>, JpaSpecificationExecutor<AppPlatform> {
    @Query("SELECT platform FROM AppPlatform platform WHERE platform.platformType = PlatformType.DOCKER AND platform.deletedAt IS NULL ORDER BY platform.updatedAt DESC, platform.createdAt DESC")
    List<AppPlatform> findDockerPlatforms();

    @Query("SELECT platform FROM AppPlatform platform WHERE platform.platformType = PlatformType.SYSTEMD AND platform.deletedAt IS NULL ORDER BY platform.updatedAt DESC, platform.createdAt DESC")
    List<AppPlatform> findSystemDPlatforms();

    @Query("SELECT platform FROM AppPlatform platform WHERE platform.systemdSSHHost = :host AND platform.systemdSSHPort = :port AND platform.deletedAt IS NULL")
    Optional<AppPlatform> findByHostPort(String host, int port);

    @Modifying
    @Query(nativeQuery = true, value = "UPDATE app_platform SET host_keys = COALESCE(host_keys, '[]'::jsonb) || jsonb_build_array(CAST(:hostKey AS TEXT)) WHERE id = :id AND deleted_at IS NULL")
    void updateHostKey(@Param("id") UUID id, @Param("hostKey") String hostKey);

    boolean existsByName(String name);

    boolean existsByCredentialId(UUID credentialId);
}