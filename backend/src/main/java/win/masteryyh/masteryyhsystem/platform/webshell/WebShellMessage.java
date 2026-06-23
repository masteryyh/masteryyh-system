package win.masteryyh.masteryyhsystem.platform.webshell;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record WebShellMessage(
        String type,
        String data,
        Integer cols,
        Integer rows,
        String reason,
        String message
) {}
