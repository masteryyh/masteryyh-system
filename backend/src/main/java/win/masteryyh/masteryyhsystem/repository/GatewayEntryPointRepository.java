package win.masteryyh.masteryyhsystem.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import win.masteryyh.masteryyhsystem.model.GatewayEntryPoint;

import java.util.List;
import java.util.UUID;

public interface GatewayEntryPointRepository extends JpaRepository<GatewayEntryPoint, UUID> {
    List<GatewayEntryPoint> findByGatewayIdOrderByListenPortAscNameAsc(UUID gatewayId);

    boolean existsByGatewayIdAndName(UUID gatewayId, String name);

    boolean existsByCertificateCredentialId(UUID certificateCredentialId);
}
