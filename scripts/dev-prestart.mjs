import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const lockPath = join(process.cwd(), '.next', 'dev', 'lock');
if (!existsSync(lockPath)) process.exit(0);

let info;
try {
  info = JSON.parse(readFileSync(lockPath, 'utf8'));
} catch {
  process.exit(0);
}

const pid = info?.pid;
if (!pid) process.exit(0);

try {
  process.kill(pid, 0);
} catch {
  process.exit(0);
}

console.log(`[dev-prestart] killing stale next dev (pid ${pid}, port ${info.port ?? '?'})`);
if (process.platform === 'win32') {
  spawnSync('taskkill', ['/PID', String(pid), '/F'], { stdio: 'inherit' });
} else {
  try { process.kill(pid, 'SIGTERM'); } catch {}
}

const start = Date.now();
while (Date.now() - start < 3000) {
  try { process.kill(pid, 0); } catch { break; }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
}
