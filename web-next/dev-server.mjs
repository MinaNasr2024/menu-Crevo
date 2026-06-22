import http from 'node:http';
import fs from 'node:fs';

const originalRealpathSync = fs.realpathSync.bind(fs);
const originalRealpathNative = typeof fs.realpathSync.native === 'function'
  ? fs.realpathSync.native.bind(fs.realpathSync)
  : null;

function safeRealpath(path, options) {
  try {
    return originalRealpathSync(path, options);
  } catch (error) {
    if (error?.code === 'EPERM' && String(error?.path ?? path).startsWith('C:\\Users\\Media')) {
      return path;
    }
    throw error;
  }
}

safeRealpath.native = function safeRealpathNative(path, options) {
  if (!originalRealpathNative) {
    return safeRealpath(path, options);
  }
  try {
    return originalRealpathNative(path, options);
  } catch (error) {
    if (error?.code === 'EPERM' && String(error?.path ?? path).startsWith('C:\\Users\\Media')) {
      return path;
    }
    throw error;
  }
};

fs.realpathSync = safeRealpath;
fs.realpathSync.native = safeRealpath.native;

const originalRealpathPromise = fs.promises?.realpath?.bind(fs.promises);
if (originalRealpathPromise) {
  fs.promises.realpath = async function safeRealpathPromise(path, options) {
    try {
      return await originalRealpathPromise(path, options);
    } catch (error) {
      if (error?.code === 'EPERM' && String(error?.path ?? path).startsWith('C:\\Users\\Media')) {
        return path;
      }
      throw error;
    }
  };
}

const { default: next } = await import('next');

const port = Number(process.env.PORT || 3001);
const dev = true;
const app = next({ dev, dir: process.cwd() });
const handle = app.getRequestHandler();

await app.prepare();

http
  .createServer((req, res) => {
    handle(req, res);
  })
  .listen(port, () => {
    console.log(`Next dev server listening on http://127.0.0.1:${port}`);
  });
