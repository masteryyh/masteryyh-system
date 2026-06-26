FROM gradle:9.5.1-jdk25-resolute AS builder

WORKDIR /app

COPY . .

RUN gradle clean bootJar --no-daemon

FROM eclipse-temurin:25-jre-resolute

COPY --from=builder /app/build/libs/masteryyh-system.jar .

ENTRYPOINT [ "java" ]
CMD [ "-jar", "./masteryyh-system.jar" ]
