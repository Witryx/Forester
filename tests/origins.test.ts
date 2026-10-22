import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrigins } from '../server/origins';

test('Origin odstraní cestu a povolí přesné adresy vlastního nasazení Vercelu', () => {
  const result = resolveOrigins('https://forester.example/firma/', {
    VERCEL: '1',
    VERCEL_ENV: 'production',
    VERCEL_PROJECT_PRODUCTION_URL: 'forester-peach.vercel.app',
    VERCEL_URL: 'forester-current-deploy.vercel.app',
  });
  assert.equal(result.origin, 'https://forester.example');
  assert(result.allowedOrigins.has('https://forester-peach.vercel.app'));
  assert(result.allowedOrigins.has('https://forester-current-deploy.vercel.app'));
  assert(!result.allowedOrigins.has('https://unrelated.vercel.app'));
  assert(!result.allowedOrigins.has('http://forester-peach.vercel.app'));
});

test('Preview přijímá vlastní adresu a lokální server nedůvěřuje metadatům bez VERCEL', () => {
  const preview = resolveOrigins(undefined, {
    VERCEL: '1',
    VERCEL_ENV: 'preview',
    VERCEL_URL: 'forester-preview.vercel.app',
    VERCEL_PROJECT_PRODUCTION_URL: 'forester-peach.vercel.app',
  });
  assert.equal(preview.origin, 'https://forester-preview.vercel.app');
  assert(!preview.allowedOrigins.has('https://forester-peach.vercel.app'));
  const local = resolveOrigins(undefined, { VERCEL_URL: 'untrusted.example' });
  assert.deepEqual([...local.allowedOrigins], ['http://localhost:5173']);
  assert.throws(() => resolveOrigins('file:///data'), /HTTP/);
});
