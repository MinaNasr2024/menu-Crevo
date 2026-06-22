# Hostinger Premium Web Hosting Deployment Guide

This repository already contains a Laravel-ready layer under `laravel-backend/`.  
For shared hosting, the safest deployment path is:

## What to upload

- Upload the contents of `laravel-backend/` to the hosting `public_html` folder or to a domain subfolder.
- If you want the current React frontend, build it separately and upload the compiled files to the web root or a matching static path.

## Production `.env`

Edit `laravel-backend/.env` with production values:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://your-domain.com`
- `DB_CONNECTION=mysql`
- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_DATABASE=your_database_name`
- `DB_USERNAME=your_database_user`
- `DB_PASSWORD=your_database_password`
- `SESSION_DRIVER=file`
- `CACHE_STORE=file`
- `QUEUE_CONNECTION=sync`
- `FILESYSTEM_DISK=public`

If you keep the legacy Node backend for now, set:

- `LEGACY_BACKEND_URL=https://api.your-legacy-backend.com`

> Shared hosting cannot run the Node backend itself. The Laravel proxy can only forward to an externally reachable backend.

## Laravel commands

Run these on the server if SSH is available:

```bash
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan storage:link
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## Current status

- The Laravel layer is production-friendly for shared hosting.
- The legacy Node/React stack remains in the repository and is not deleted.
- Full migration from Node/Prisma to Laravel/MySQL is still a separate codebase task if you want everything running only on PHP.
