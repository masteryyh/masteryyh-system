package win.masteryyh.masteryyhsystem;

import jakarta.annotation.PreDestroy;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;
import win.masteryyh.masteryyhsystem.base.utils.AsyncTaskExecutor;

@SpringBootApplication
@EnableConfigurationProperties
@EnableJpaAuditing
@EnableScheduling
public class Application {
    static void main(String[] args) {
        AsyncTaskExecutor.installDefaultUncaughtExceptionHandler();
        SpringApplication.run(Application.class, args);
    }

    @PreDestroy
    public void shutdown() {
        AsyncTaskExecutor.shutdown();
    }
}
