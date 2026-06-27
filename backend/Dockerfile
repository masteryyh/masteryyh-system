FROM eclipse-temurin:25-jre-resolute

WORKDIR /app

COPY build/libs/masteryyh-system.jar .

ENTRYPOINT [ "java" ]
CMD [ "-jar", "./masteryyh-system.jar", \
    "--spring.data.redis.redisson.file=file:/app/config/redisson.yaml", \
    "--spring.config.additional-location=optional:file:/app/config/" ]
