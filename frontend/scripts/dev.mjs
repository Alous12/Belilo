import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = process.cwd();
const backendRoot = resolve(root, '..', 'backend');
const backend = spawn(process.execPath, ['--env-file-if-exists=.env', join(backendRoot, 'src/server.js')], { cwd: backendRoot, stdio: 'inherit' });
const angular = spawn(process.execPath, [join(root, 'node_modules/@angular/cli/bin/ng.js'), 'serve', ...process.argv.slice(2)], { stdio: 'inherit' });

let stopped = false;
function stop(code = 0) {
  if (stopped) return;
  stopped = true;
  backend.kill();
  angular.kill();
  process.exitCode = code;
}
backend.on('exit', code => stop(code ?? 1));
angular.on('exit', code => stop(code ?? 1));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
