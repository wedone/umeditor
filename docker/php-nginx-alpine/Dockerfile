
FROM php:8.2-fpm-alpine3.18

LABEL maintainer="repo: wedone/umeditor"

# Install nginx, supervisor and utilities. Use the official php image to avoid
# needing distribution php packages which may be missing on some architectures.
RUN apk add --no-cache \
    nginx \
    supervisor \
    tzdata \
    ca-certificates \
    curl \
    bash

# Set working directory and copy project
WORKDIR /var/www/html
# Copy the provided PHP-ready UMEditor package into the web root so the image
# is "out-of-the-box" usable. This copies the folder `umeditor1_2_3-utf8-php`
# from the repository into the container root.
COPY umeditor1_2_3-utf8-php/ /var/www/html/

# Install common PHP extensions (pdo_mysql, mbstring, xml, gd)
# Use build dependencies to compile extensions where needed
RUN apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    libpng-dev libjpeg-turbo-dev libwebp-dev zlib-dev mariadb-dev \
  && docker-php-ext-configure gd --with-jpeg --with-webp \
  && docker-php-ext-install -j"$(nproc)" gd pdo_mysql mbstring xml \
  && apk del .build-deps

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
