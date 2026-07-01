const test = require('node:test');
const assert = require('node:assert/strict');

const { app } = require('../server');

test('health endpoint responds successfully', async () => {
  const server = app.listen(0, '127.0.0.1');

  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()));
    });
  }
});
