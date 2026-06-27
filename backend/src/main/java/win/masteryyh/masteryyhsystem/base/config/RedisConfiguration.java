package win.masteryyh.masteryyhsystem.base.config;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.redisson.spring.data.connection.RedissonConnectionFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.io.Resource;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.RedisSerializer;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Configuration
public class RedisConfiguration {
    @Bean
    public RedisConnectionFactory redissonConnectionFactory(RedissonClient client) {
        return new RedissonConnectionFactory(client);
    }

    @Bean(destroyMethod = "shutdown")
    public RedissonClient redissonClient(@Value("${spring.data.redis.redisson.file}") Resource configFile,
                                         Environment environment) throws IOException {
        String file = new String(configFile.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        file = environment.resolvePlaceholders(file);
        Config config = Config.fromYAML(file);
        return Redisson.create(config);
    }

    @Bean
    public RedisTemplate<?, ?> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<?, ?> redisTemplate = new RedisTemplate<>();
        redisTemplate.setConnectionFactory(connectionFactory);
        redisTemplate.setKeySerializer(RedisSerializer.string());
        redisTemplate.setValueSerializer(RedisSerializer.json());
        redisTemplate.setHashKeySerializer(RedisSerializer.string());
        redisTemplate.setHashValueSerializer(RedisSerializer.json());
        redisTemplate.afterPropertiesSet();
        return redisTemplate;
    }
}
