import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError } from '../src/api';

test('API klient vrátí srozumitelnou chybu při textové chybě Vercelu', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response('A server error has occurred\nFUNCTION_INVOCATION_FAILED', { status: 500 }),
  );
  await assert.rejects(
    () => api('/bootstrap'),
    (error: unknown) => {
      assert(error instanceof ApiError);
      assert.equal(error.status, 500);
      assert.match(error.message, /Server je dočasně nedostupný/);
      assert(!error.message.includes('Unexpected token'));
      return true;
    },
  );
});

test('API klient zachová data a zprávy skutečných JSON odpovědí', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'ok' }));
  assert.deepEqual(await api('/health'), { status: 'ok' });
  fetch.mock.mockImplementation(async () =>
    Response.json({ message: 'Účet už existuje.' }, { status: 409 }),
  );
  await assert.rejects(
    () => api('/users'),
    (error: unknown) =>
      error instanceof ApiError && error.status === 409 && error.message === 'Účet už existuje.',
  );
});
