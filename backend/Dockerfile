FROM eclipse-temurin:25-jre-resolute

WORKDIR /app

COPY build/libs/masteryyh-system.jar .

ENTRYPOINT [ "java" ]
CMD [ "-jar", "./masteryyh-system.jar", \
    "--spring.config.additional-location=optional:file:/app/config/" ]
