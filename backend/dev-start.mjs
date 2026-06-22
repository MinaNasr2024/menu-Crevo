process.env.PORT ??= '4006';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/crevo_menu?schema=public';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5182,http://127.0.0.1:5182';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.ADMIN_USERNAME ??= 'admin';
process.env.ADMIN_PASSWORD ??= 'admin123';
process.env.ADMIN_TOKEN ??= 'change-me-in-production';

await import('./src/server.js');
