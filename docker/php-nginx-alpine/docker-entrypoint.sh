#!/bin/sh
set -e

# Ensure www-data style permissions (php official image uses www-data)
chown -R www-data:www-data /var/www/html || true

# Generate php-fpm socket config to listen on 127.0.0.1:9000 if default uses socket
# (alpine php-fpm default listens on 127.0.0.1:9000 already for php8)

exec /usr/bin/supervisord -c /etc/supervisord.conf
