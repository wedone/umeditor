FROM alpine:3.18

LABEL maintainer="repo: wedone/umeditor"

RUN apk add --no-cache \
    nginx \
    php8-fpm \
    php8-cli \
    php8-opcache \
    php8-mbstring \
    php8-pdo \
    php8-pdo_mysql \
    php8-json \
    php8-xml \
    php8-gd \
    php8-curl \
    php8-session \
    php8-fileinfo \
    supervisor \
    tzdata \
    ca-certificates \
    curl \
    bash

# Create app directory
WORKDIR /var/www/html

# Copy project files
COPY . /var/www/html

# nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Supervisor config and entrypoint
COPY supervisord.conf /etc/supervisord.conf
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
