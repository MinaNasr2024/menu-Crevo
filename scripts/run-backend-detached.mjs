import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const backendDir = path.join(rootDir, 'backend');
const nodeExe = process.env.NODE_EXE || 'C:\\Program Files\\nodejs\\node.exe';

const child = spawn(
  nodeExe,
  ['--preserve-symlinks', '--preserve-symlinks-main', 'dev-start.mjs'],
  {
    cwd: backendDir,
    env: {
      ...process.env,
      DOTENV_CONFIG_PATH: path.join(backendDir, '.env')
    },
    stdio: 'ignore',
    detached: true,
    windowsHide: true
  }
);

child.unref();
console.log(`Backend detached pid ${child.pid}`);
