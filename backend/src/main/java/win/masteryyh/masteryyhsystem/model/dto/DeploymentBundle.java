package win.masteryyh.masteryyhsystem.model.dto;

import java.util.List;
import java.util.Map;

public record DeploymentBundle(Map<String, byte[]> files,
                               List<Integer> listenPorts,
                               boolean customMainConfig) {
}
