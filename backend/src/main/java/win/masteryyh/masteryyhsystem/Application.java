package win.masteryyh.masteryyhsystem;

import jakarta.annotation.PreDestroy;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import win.masteryyh.masteryyhsystem.base.utils.AsyncTaskExecutor;

@SpringBootApplication
@EnableConfigurationProperties
@EnableJpaAuditing
public class Application {
    static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @PreDestroy
    public void shutdown() {
        AsyncTaskExecutor.shutdown();
    }
}
