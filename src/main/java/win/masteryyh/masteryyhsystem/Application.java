package win.masteryyh.masteryyhsystem;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties
public class Application {
    static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
