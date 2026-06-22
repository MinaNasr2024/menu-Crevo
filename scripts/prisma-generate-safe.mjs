import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd());
const backendDir = path.join(rootDir, 'backend');
const prismaClientDir = path.join(rootDir, 'node_modules', '.prisma', 'client');

async function removeTempEngines() {
  try {
    const entries = await fs.readdir(prismaClientDir);
    await Promise.all(
      entries
        .filter((name) => name.startsWith('query_engine-windows.dll.node.tmp'))
        .map((name) => fs.rm(path.join(prismaClientDir, name), { force: true }))
    );
  } catch {
    // Ignore missing folders or locked temp files.
  }
}

function runPrismaGenerate() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['prisma', 'generate', '--schema', 'prisma/schema.prisma'], {
      cwd: backendDir,
      shell: true,
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`prisma generate failed with exit code ${code}`));
      }
    });
  });
}

async function main() {
  const attempts = 4;
  let lastError = null;

  for (let index = 1; index <= attempts; index += 1) {
    await removeTempEngines();
    try {
      await runPrismaGenerate();
      console.log('Prisma client generated successfully.');
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Prisma generate attempt ${index} failed: ${error.message}`);
      if (index < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * index));
      }
    }
  }

  console.warn('Prisma generate could not complete after retries. Please rerun npm run prisma:generate -w backend after closing apps that may lock node_modules.');
  if (lastError) {
    console.warn(lastError.message);
  }
  process.exitCode = 0;
}

main().catch((error) => {
  console.warn(error.message);
  process.exitCode = 0;
});
