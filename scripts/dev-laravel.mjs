import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const backendDir = path.join(rootDir, 'backend');
const laravelDir = path.join(rootDir, 'laravel-backend');
const nodeExe = process.env.NODE_EXE || process.execPath;

function spawnDetached(command, args, cwd, env = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'ignore',
    detached: true,
    windowsHide: true
  });
  child.unref();
  return child.pid;
}

const backendPid = spawnDetached(
  nodeExe,
  ['--preserve-symlinks', '--preserve-symlinks-main', 'dev-start.mjs'],
  backendDir,
  {
    DOTENV_CONFIG_PATH: path.join(backendDir, '.env')
  }
);

const frontendPid = spawnDetached(
  nodeExe,
  ['scripts/serve-frontend.mjs'],
  rootDir
);

const phpExe = process.env.PHP_EXE || 'php';
const laravelPid = spawnDetached(
  phpExe,
  ['artisan', 'serve', '--host', '127.0.0.1', '--port', '8000'],
  laravelDir
);

console.log(`Backend detached pid ${backendPid}`);
console.log(`Frontend detached pid ${frontendPid}`);
console.log(`Laravel detached pid ${laravelPid}`);
