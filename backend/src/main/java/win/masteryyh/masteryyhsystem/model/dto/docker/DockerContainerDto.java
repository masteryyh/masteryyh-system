package win.masteryyh.masteryyhsystem.model.dto.docker;

import java.io.Serializable;
import java.util.List;

public record DockerContainerDto(String id, String name, String image, String imageId,
                                 String state, String status, Long createdAt, String command,
                                 List<String> ports) implements Serializable {
}
