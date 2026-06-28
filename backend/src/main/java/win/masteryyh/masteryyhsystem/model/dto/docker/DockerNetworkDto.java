package win.masteryyh.masteryyhsystem.model.dto.docker;

import java.io.Serializable;

public record DockerNetworkDto(String id, String name, String driver, String scope,
                               boolean internal) implements Serializable {
}
