# Crevo Digital Menu

Monorepo for a restaurant digital menu, waiter calling system, admin dashboard, and BI reporting module.

## Laravel migration mode

The repository now includes `laravel-backend/` as a Laravel gateway. It proxies the existing API so the frontend can start using Laravel immediately without losing current behavior.

### Premium Web Hosting deployment

If you are deploying to Hostinger Premium Web Hosting, use the Laravel layer as the PHP entry point and move the runtime configuration to production values:

1. Upload the contents of `laravel-backend/` to the hosting `public_html` directory or to a subfolder assigned to your domain.
2. Set `.env` with your real domain and MySQL credentials.
3. Run `composer install --no-dev --optimize-autoloader` on the server if SSH is available, or upload the prepared `vendor/` folder.
4. Run `php artisan key:generate`, `php artisan storage:link`, and `php artisan migrate --force`.
5. If you are keeping the legacy Node backend temporarily, set `LEGACY_BACKEND_URL` to the public URL of that API. Shared hosting cannot run the Node backend itself.
6. Build the React frontend separately and publish it on the same domain or a subdomain that points to the Laravel app.

The Laravel scaffold in this repository is already aligned with production-friendly defaults in `laravel-backend/.env.example`:
- MySQL instead of SQLite
- file sessions instead of database sessions
- file cache instead of database cache
- sync queue instead of database queue
- public filesystem disk for uploads

Run the default stack:

```bash
npm run dev
```

This starts:
- the legacy Node API
- the React frontend

If you need the old-only setup, use `npm run dev:legacy`.
If you need the Laravel-enabled stack, use `npm run dev:laravel`.

## Stack

- Backend: Node.js + Express + Prisma + PostgreSQL
- Frontend: React + React Router v6 + Tailwind CSS + Vite
- Realtime: Socket.IO
- Cache layer: Redis-ready, with a fallback approach in the current scaffold

## What Was Added

- QR-bound table sessions
- Customer menu with Arabic/English toggle
- Product discounts and modal gallery
- Waiter calling flow
- Admin CRUD for categories/products/tables
- Enterprise BI module with KPIs, analytics, audit logs, and exports
- PWA manifest and service worker

## Note

- The active frontend is `frontend/` only.
- `web-next/` is kept in the repository as a legacy backup copy, but it is no longer part of the workspace scripts or the normal build/dev flow.
- `laravel-backend/` is the deployable PHP layer for shared hosting. It can be used without removing the current Node/React stack.

## Run Locally

> Recommended Node.js version: `20.19.0+` or `22.12.0+` to avoid Vite engine warnings.

1. Start the database stack:
   ```bash
   docker compose up -d
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the backend environment file and edit it if needed:
   ```bash
   copy backend\.env.example backend\.env
   ```
4. Run Prisma migrations:
   ```bash
   npm run prisma:migrate -w backend
   ```
5. Start the app:
   ```bash
   npm run dev
   ```

## Admin Login

- Username: `admin`
- Password: `admin123`

## Product Uploads

- In the product form, use `Upload cover file` and `Upload gallery files`.
- Uploaded files are stored under `backend/uploads` and served from the backend.

## Troubleshooting

- If Prisma throws an `EPERM` error mentioning `C:\Users\Media`, move the project to a simpler path such as `C:\food--Crevo` and rerun the migration.
- If Vite complains about the Node version, upgrade Node to `20.19.0+` or `22.12.0+`.
- If a migration fails and Prisma asks for resolution, run:
  ```bash
  npx prisma migrate resolve --rolled-back 20260608150418 --schema backend/prisma/schema.prisma
  npm run prisma:migrate -w backend
  ```

## Open In Browser

- Customer menu: `http://localhost:5173/menu`
- Admin dashboard: `http://localhost:5173/admin`
- BI dashboard: `http://localhost:5173/insights`

## Database Notes

- The primary database is PostgreSQL.
- The reporting layer adds analytics tables, audit logs, inventory, expenses, and reporting views.
- If you want to switch to a managed PostgreSQL instance, update `backend/.env`.
"# menu-Crevo" 
