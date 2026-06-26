package win.masteryyh.masteryyhsystem.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import win.masteryyh.masteryyhsystem.model.GatewayRoute;

import java.util.List;
import java.util.UUID;

public interface GatewayRouteRepository extends JpaRepository<GatewayRoute, UUID> {
    List<GatewayRoute> findByEntryPointIdOrderByPriorityDescPathPrefixAsc(UUID entryPointId);

    List<GatewayRoute> findByEntryPointIdInOrderByPriorityDescPathPrefixAsc(List<UUID> entryPointIds);

    boolean existsByEntryPointIdAndName(UUID entryPointId, String name);

    boolean existsByStaticFileId(UUID staticFileId);

    List<GatewayRoute> findByStaticFileId(UUID staticFileId);
}
