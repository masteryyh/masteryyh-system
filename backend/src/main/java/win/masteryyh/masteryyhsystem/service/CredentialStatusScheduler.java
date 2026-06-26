package win.masteryyh.masteryyhsystem.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

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
            logger.error("Credential status scan failed", e);
        }
    }
}
