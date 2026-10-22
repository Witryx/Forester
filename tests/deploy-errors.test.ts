import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDeploymentError, DeploymentConfigError } from '../server/deploy-errors';
import { openPostgres } from '../server/postgres';

test('Diagnostika rozliší chybu připojení, migrace a konfigurace bez úniku údajů', () => {
  const secret = 'postgresql://user:secret-password@private-host/db';
  const auth = describeDeploymentError(
    { code: '28P01', message: secret, detail: secret },
    'připojení',
  );
  assert.match(auth, /\[připojení\] 28P01/);
  assert(!auth.includes(secret));
  const migration = describeDeploymentError(
    { code: '42P07', message: secret, position: '123' },
    'migrace',
  );
  assert.match(migration, /\[migrace\] 42P07/);
  assert.match(migration, /Pozice v SQL: 123/);
  assert(!migration.includes('private-host'));
  assert(!describeDeploymentError(new Error(secret), 'připojení').includes(secret));
  assert(!describeDeploymentError({ code: secret, position: secret }, 'migrace').includes(secret));
  assert.match(
    describeDeploymentError(new DeploymentConfigError('Nastavte DATABASE_URL.'), 'nastavení'),
    /CONFIG: Nastavte DATABASE_URL/,
  );
});

test('Připojení výslovně zachová ověřování certifikátu pro SSL aliasy pg 8', async () => {
  for (const mode of ['prefer', 'require', 'verify-ca', 'verify-full']) {
    const { pool } = openPostgres(
      `postgresql://user:password@localhost/db?sslmode=${mode}&channel_binding=require`,
    );
    try {
      const url = new URL(pool.options.connectionString!);
      assert.equal(url.searchParams.get('sslmode'), 'verify-full');
      assert.equal(url.searchParams.get('channel_binding'), 'require');
      assert.equal(url.password, 'password');
    } finally {
      await pool.end();
    }
  }
  const { pool } = openPostgres('postgresql://user:password@localhost/db?sslmode=disable');
  try {
    assert.equal(new URL(pool.options.connectionString!).searchParams.get('sslmode'), 'disable');
  } finally {
    await pool.end();
  }
  assert.throws(() => openPostgres('not-a-database-url'), DeploymentConfigError);
});
