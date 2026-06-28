process.env.PORT ??= '4009';
process.env.DATABASE_URL ??= 'mysql://root:root@127.0.0.1:3306/crevo_menu';
process.env.CLIENT_ORIGIN ??= 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5182,http://127.0.0.1:5182';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.ADMIN_USERNAME ??= 'admin';
process.env.ADMIN_PASSWORD ??= 'admin123';
process.env.ADMIN_TOKEN ??= 'change-me-in-production';

await import('./src/server.js');

