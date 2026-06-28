package win.masteryyh.masteryyhsystem.model.dto.docker;

import java.io.Serializable;

public record DockerVolumeDto(String name, String driver, String mountpoint) implements Serializable {
}
