package win.masteryyh.masteryyhsystem.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 凭据状态后台扫描器。每 5 分钟轮询一次所有凭据，按过期时间与 platform 引用情况
 * 重新计算 status。计算逻辑全部落在 {@link CredentialService#recomputeAllStatuses()}，
 * 这里只负责定时触发。
 */
@Component
public class CredentialStatusScheduler {
    private static final Logger logger = LoggerFactory.getLogger(CredentialStatusScheduler.class);

    private final CredentialService credentialService;

    public CredentialStatusScheduler(CredentialService credentialService) {
        this.credentialService = credentialService;
    }

    @Scheduled(fixedRate = 5 * 60 * 1000, initialDelay = 30 * 1000)
    public void scan() {
        logger.debug("Starting credential status scan");
        try {
            int changed = credentialService.recomputeAllStatuses();
            if (changed > 0) {
                logger.info("Credential status scan completed: {} credential(s) updated", changed);
            } else {
                logger.debug("Credential status scan completed: no changes");
            }
        } catch (Exception e) {
            // 不让定时任务因为一次失败就停摆，记录错误后等待下一轮。
            logger.error("Credential status scan failed", e);
        }
    }
}
