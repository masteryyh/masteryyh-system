FROM node:lts-slim AS builder

ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN apt-get update && apt-get install git

WORKDIR /app

COPY . .

RUN corepack enable pnpm && \
    pnpm install && \
    pnpm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/ /usr/share/nginx/html/
