import assert from 'node:assert/strict';

// Import the compiled ESM entry in native Node, without tsx/Vite resolution helpers.
// Loading the module must not require credentials or create a database connection.
const { default: handler } = await import('../artifacts/runtime/api/index.js');
assert.equal(typeof handler, 'function');
console.log('Serverové API lze načíst v nativním Node.js.');
