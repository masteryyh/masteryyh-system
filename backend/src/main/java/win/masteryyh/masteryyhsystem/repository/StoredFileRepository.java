package win.masteryyh.masteryyhsystem.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import win.masteryyh.masteryyhsystem.model.StoredFile;

import java.util.UUID;

public interface StoredFileRepository extends
        JpaRepository<StoredFile, UUID>, JpaSpecificationExecutor<StoredFile> {
    boolean existsByName(String name);
}
