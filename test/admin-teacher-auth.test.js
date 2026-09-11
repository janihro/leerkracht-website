const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, waitForServer } = require('./helpers');

const PORT = 5102;
const ADMIN_PASS = 'testadmin123';
let baseUrl, server;

test.before(async () => {
  ({ baseUrl, server } = startServer({ port: PORT, adminPassword: ADMIN_PASS }));
  await waitForServer(baseUrl);
});

test.after(() => server.close());

test('Admin-route weigert toegang zonder geldige inloggegevens', async () => {
  const res = await fetch(baseUrl + '/api/admin/stats', {
    headers: { 'x-admin-username': 'beheerder', 'x-admin-password': 'verkeerd-wachtwoord' },
  });
  assert.equal(res.status, 401);
});

test('Admin-route accepteert de juiste inloggegevens', async () => {
  const res = await fetch(baseUrl + '/api/admin/stats', {
    headers: { 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok('totalRegistrations' in data);
});

test('Een docent zonder het juiste recht krijgt geen toegang tot inschrijvingen', async () => {
  const createRes = await fetch(baseUrl + '/api/admin/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS },
    body: JSON.stringify({ name: 'Test Docent', username: 'testdocent', password: 'wachtwoord123', permissions: ['vragen'] }),
  });
  assert.equal(createRes.status, 201);

  const res = await fetch(baseUrl + '/api/registrations', {
    headers: { 'x-teacher-username': 'testdocent', 'x-teacher-password': 'wachtwoord123' },
  });
  assert.equal(res.status, 401);
});

test('Een docent mét het juiste recht krijgt wel toegang tot inschrijvingen', async () => {
  await fetch(baseUrl + '/api/admin/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS },
    body: JSON.stringify({ name: 'Test Docent 2', username: 'testdocent2', password: 'wachtwoord123', permissions: ['inschrijvingen'] }),
  });

  const res = await fetch(baseUrl + '/api/registrations', {
    headers: { 'x-teacher-username': 'testdocent2', 'x-teacher-password': 'wachtwoord123' },
  });
  assert.equal(res.status, 200);
});
