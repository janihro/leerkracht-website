const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, waitForServer } = require('./helpers');

const PORT = 5105;
const ADMIN_PASS = 'testadmin123';
let baseUrl, server;

test.before(async () => {
  ({ baseUrl, server } = startServer({ port: PORT, adminPassword: ADMIN_PASS }));
  await waitForServer(baseUrl);
});

test.after(() => server.close());

function adminHeaders(extra) {
  return { 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS, ...extra };
}

test('Passkey-registratie starten vereist een ingelogde beheerder', async () => {
  const res = await fetch(baseUrl + '/api/admin/passkey/register-options', { method: 'POST' });
  assert.equal(res.status, 401);
});

test('Passkey-registratie starten geeft geldige opties terug voor een ingelogde beheerder', async () => {
  const res = await fetch(baseUrl + '/api/admin/passkey/register-options', { method: 'POST', headers: adminHeaders() });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.challengeId);
  assert.ok(data.options.challenge);
  assert.equal(data.options.rp.name, 'NONF Beheer');
  assert.equal(data.options.user.name, 'beheerder');
});

test('Passkey-registratie afronden met een ongeldig antwoord wordt geweigerd, niet gecrasht', async () => {
  const optRes = await fetch(baseUrl + '/api/admin/passkey/register-options', { method: 'POST', headers: adminHeaders() });
  const { challengeId } = await optRes.json();
  const res = await fetch(baseUrl + '/api/admin/passkey/register-verify', {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ challengeId, response: { id: 'niet-echt', rawId: 'niet-echt', type: 'public-key', response: {} }, deviceName: 'Test' }),
  });
  assert.equal(res.status, 400);
});

test('Een verlopen/onbekende challengeId wordt geweigerd', async () => {
  const res = await fetch(baseUrl + '/api/admin/passkey/register-verify', {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ challengeId: 'bestaat-niet', response: {} }),
  });
  assert.equal(res.status, 400);
});

test('Eigen passkeys ophalen vereist login en geeft lege lijst terug zonder geregistreerde passkeys', async () => {
  const unauth = await fetch(baseUrl + '/api/admin/passkey/list');
  assert.equal(unauth.status, 401);
  const res = await fetch(baseUrl + '/api/admin/passkey/list', { headers: adminHeaders() });
  assert.equal(res.status, 200);
  const list = await res.json();
  assert.deepEqual(list, []);
});

test('Passkey-login: opties ophalen kan altijd (geen inlog nodig), onbekende credential wordt geweigerd', async () => {
  const optRes = await fetch(baseUrl + '/api/admin/passkey/login-options', { method: 'POST' });
  assert.equal(optRes.status, 200);
  const { challengeId, options } = await optRes.json();
  assert.ok(challengeId);
  assert.ok(options.challenge);

  const res = await fetch(baseUrl + '/api/admin/passkey/login-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, response: { id: 'onbekende-credential-id', rawId: 'x', type: 'public-key', response: {} } }),
  });
  assert.equal(res.status, 401);
});

test('Een geldig sessietoken alléén (zonder wachtwoord) is genoeg voor gewone admin-routes — nodig voor passkey-only sessies', async () => {
  const loginRes = await fetch(baseUrl + '/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS },
    body: JSON.stringify({ trustDevice: false }),
  });
  assert.equal(loginRes.status, 200);
  const { sessionToken } = await loginRes.json();
  assert.ok(sessionToken);

  // Geen username/password meegestuurd — enkel het sessietoken, zoals een
  // beheerder die via passkey is ingelogd en geen wachtwoord kent.
  const res = await fetch(baseUrl + '/api/admin/stats', { headers: { 'x-admin-session': sessionToken } });
  assert.equal(res.status, 200);
});
