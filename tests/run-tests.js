const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const dbPath = path.join(os.tmpdir(), `binpulse-test-${process.pid}.sqlite`);
const env = { ...process.env, DB_PATH: dbPath };
const testFiles = fs.readdirSync(__dirname)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => path.join(__dirname, name));

function run(args) {
  return spawnSync(process.execPath, args, { cwd: path.resolve(__dirname, '..'), env, stdio: 'inherit' });
}

try {
  const seed = run([path.resolve(__dirname, '../simulator/seedData.js')]);
  if (seed.error) throw seed.error;
  if (seed.status !== 0) process.exitCode = seed.status || 1;
  else {
    const tests = run(['--test', '--test-concurrency=1', ...testFiles]);
    if (tests.error) throw tests.error;
    process.exitCode = tests.status ?? 1;
  }
} finally {
  for (const suffix of ['', '-shm', '-wal']) {
    try {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    } catch (error) {
      console.warn(`Could not remove temporary test database ${dbPath}${suffix}: ${error.message}`);
    }
  }
}
