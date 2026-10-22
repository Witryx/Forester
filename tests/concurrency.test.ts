import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { openDb } from '../server/db';
import { seedDemo } from '../server/seed';
test('AT-05: dva samostatné procesy současně rezervují stejný tahač; uspěje jen jeden', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'forester-test-'));
  const path = join(folder, 'concurrent.sqlite');
  try {
    const db = openDb(path);
    await seedDemo(db);
    db.close();
    const common = {
      pickup: 'Les',
      delivery: 'Pila',
      startsAt: '2027-01-20T10:00:00+01:00',
      endsAt: '2027-01-20T12:00:00+01:00',
      vehicleId: 'vehicle-1',
      requiresCrane: true,
      requiresTrailer: true,
      weightKg: 22000,
      approvedCapacityKg: 26000,
    };
    const workers = [1, 2].map((i) =>
      spawn(
        process.execPath,
        [
          '--import',
          'tsx',
          'tests/reservation-worker.ts',
          path,
          JSON.stringify({
            ...common,
            employeeId: `driver-${i}`,
            trailerId: `trailer-${i}`,
          }),
        ],
        { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] },
      ),
    );
    const results = workers.map(
      (worker) =>
        new Promise<string>((done, reject) => {
          let output = '';
          let stderr = '';
          worker.stdout.on('data', (chunk) => {
            output += String(chunk);
          });
          worker.stderr.on('data', (chunk) => {
            stderr += String(chunk);
          });
          worker.once('error', reject);
          worker.once('exit', (code) => (code === 0 ? done(output) : reject(new Error(stderr))));
        }),
    );
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise<void>((done) => {
            worker.stdout.on('data', (chunk) => {
              if (String(chunk).includes('ready')) done();
            });
          }),
      ),
    );
    workers.forEach((worker) => worker.stdin.write('go\n'));
    const output = await Promise.all(results);
    assert.equal(output.filter((s) => s.includes('success')).length, 1);
    assert.equal(output.filter((s) => s.includes('conflict')).length, 1);
    const verify = openDb(path);
    assert.equal(verify.prepare("SELECT COUNT(*) AS n FROM orders WHERE pickup='Les'").get()!.n, 1);
    verify.close();
  } finally {
    const target = resolve(folder);
    assert.ok(
      target.startsWith(resolve(tmpdir()) + '\\') || target.startsWith(resolve(tmpdir()) + '/'),
    );
    assert.ok(target.includes('forester-test-'));
    rmSync(target, { recursive: true, force: true });
  }
});
