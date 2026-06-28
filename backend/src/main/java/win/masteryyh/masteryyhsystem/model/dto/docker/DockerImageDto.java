package win.masteryyh.masteryyhsystem.model.dto.docker;

import java.io.Serializable;
import java.util.List;

public record DockerImageDto(String id, List<String> repoTags, String arch, String os,
                             Long size, String createdAt) implements Serializable {
}
