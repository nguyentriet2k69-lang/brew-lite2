import { spawn } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

async function start() {
  const standaloneDirectory = path.resolve('.next/standalone');
  await mkdir(path.join(standaloneDirectory, '.next'), { recursive: true });
  await cp('.next/static', path.join(standaloneDirectory, '.next/static'), {
    recursive: true,
    force: true,
  });
  await cp('public', path.join(standaloneDirectory, 'public'), {
    recursive: true,
    force: true,
  });

  const server = spawn(process.execPath, ['server.js'], {
    cwd: standaloneDirectory,
    env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: '4173' },
    stdio: 'inherit',
  });
  const stopServer = (signal) => server.kill(signal);
  process.on('SIGINT', stopServer);
  process.on('SIGTERM', stopServer);
  server.on('exit', (code) => process.exit(code ?? 1));
  server.on('error', (error) => {
    console.error('Standalone web server process failed:', error);
    process.exitCode = 1;
  });
}

start().catch((error) => {
  console.error('Failed to start the standalone web server:', error);
  process.exitCode = 1;
});
