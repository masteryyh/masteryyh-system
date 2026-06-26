FROM node:lts-slim AS builder

WORKDIR /app

COPY . .

RUN corepack enable pnpm && \
    pnpm install && \
    pnpm run build

FROM nginx:alpine

COPY --from=builder /app/dist/ /usr/share/nginx/html/
