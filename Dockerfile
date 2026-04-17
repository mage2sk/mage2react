# Multi-version PHP-FPM image for Magento 2
# Supports: 7.4, 8.1, 8.2, 8.3, 8.4
# Usage: docker build --build-arg PHP_VERSION=8.1 .

ARG PHP_VERSION=8.1
FROM php:${PHP_VERSION}-fpm

ARG PHP_VERSION=8.1

# Install system dependencies (same across Debian Buster/Bullseye/Bookworm)
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    unzip \
    zip \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libonig-dev \
    libxml2-dev \
    libxslt-dev \
    libzip-dev \
    libicu-dev \
    libmagickwand-dev \
    imagemagick \
    libsodium-dev \
    msmtp \
    && rm -rf /var/lib/apt/lists/*

# Configure msmtp to relay all PHP mail() to Mailpit
RUN printf "account default\nhost mailpit\nport 1025\nfrom no-reply@local.test\n" > /etc/msmtprc && \
    chmod 644 /etc/msmtprc

# Configure GD (--with-freetype/--with-jpeg syntax works for PHP 7.4+)
RUN docker-php-ext-configure gd \
    --with-freetype \
    --with-jpeg

# Install PHP extensions required by Magento 2
RUN docker-php-ext-install -j$(nproc) \
    bcmath \
    dom \
    ftp \
    gd \
    intl \
    mbstring \
    opcache \
    pdo \
    pdo_mysql \
    simplexml \
    soap \
    sockets \
    sodium \
    xsl \
    zip

# Install Redis PECL extension
RUN pecl install redis \
    && docker-php-ext-enable redis

# Install Imagick PECL extension
# PHP 7.4 - 8.3: imagick stable works fine
# PHP 8.4:       needs 3.8.0alpha or newer — try stable first, fall back automatically
RUN PHP_MINOR=$(php -r "echo PHP_MAJOR_VERSION * 10 + PHP_MINOR_VERSION;") \
    && if [ "$PHP_MINOR" -ge "84" ]; then \
         pecl install imagick 2>/dev/null \
         || pecl install imagick-3.8.0alpha1 \
         || echo "WARNING: imagick not installed for PHP ${PHP_VERSION}"; \
       else \
         pecl install imagick; \
       fi \
    && docker-php-ext-enable imagick 2>/dev/null || true

# Install Composer 2
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# PHP configuration for Magento
RUN { \
    echo "memory_limit = 4G"; \
    echo "max_execution_time = 1800"; \
    echo "zlib.output_compression = On"; \
    echo "max_input_vars = 10000"; \
    echo "upload_max_filesize = 64M"; \
    echo "post_max_size = 64M"; \
    echo "date.timezone = UTC"; \
    echo "opcache.enable = 1"; \
    echo "opcache.memory_consumption = 512"; \
    echo "opcache.max_accelerated_files = 60000"; \
    echo "opcache.validate_timestamps = 1"; \
    echo "sendmail_path = /usr/bin/msmtp -t"; \
} > /usr/local/etc/php/conf.d/magento.ini

WORKDIR /var/www/html

RUN usermod -u 1000 www-data && groupmod -g 1000 www-data

USER www-data
