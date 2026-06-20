package win.masteryyh.masteryyhsystem.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import win.masteryyh.masteryyhsystem.model.Credential;

import java.util.UUID;

public interface CredentialRepository extends
        JpaRepository<Credential, UUID>, JpaSpecificationExecutor<Credential> {
    boolean existsByName(String name);
}