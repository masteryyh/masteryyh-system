package win.masteryyh.masteryyhsystem.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import win.masteryyh.masteryyhsystem.base.buildinfo.BuildInfo;
import win.masteryyh.masteryyhsystem.model.dto.VersionDto;

@RestController
@RequestMapping("/v1/version")
public class VersionController {
    @GetMapping
    public VersionDto get() {
        return new VersionDto(BuildInfo.VERSION, BuildInfo.COMMIT_HASH, BuildInfo.BUILD_TIME);
    }
}
