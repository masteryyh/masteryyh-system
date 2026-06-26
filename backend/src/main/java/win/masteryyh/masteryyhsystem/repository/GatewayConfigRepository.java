package win.masteryyh.masteryyhsystem.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import win.masteryyh.masteryyhsystem.model.GatewayConfig;

import java.util.List;
import java.util.UUID;

public interface GatewayConfigRepository extends
        JpaRepository<GatewayConfig, UUID>, JpaSpecificationExecutor<GatewayConfig> {

    boolean existsByName(String name);

    List<GatewayConfig> findByPlatformId(UUID platformId);
}