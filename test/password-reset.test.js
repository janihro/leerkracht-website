const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, waitForServer } = require('./helpers');

const PORT = 5103;
const ADMIN_PASS = 'testadmin123';
let baseUrl, server;

test.before(async () => {
  ({ baseUrl, server } = startServer({ port: PORT, adminPassword: ADMIN_PASS }));
  await waitForServer(baseUrl);
});

test.after(() => server.close());

async function createAccountWithoutPassword(email) {
  return fetch(baseUrl + '/api/admin/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS },
    body: JSON.stringify({ email, kindNaam: 'Testkind' }),
  });
}

test('Account zonder wachtwoord genereert automatisch een reset-token', async () => {
  const res = await createAccountWithoutPassword('ouder1@example.com');
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.emailSent, true);
});

test('Token kan één keer gebruikt worden om een wachtwoord in te stellen', async () => {
  await createAccountWithoutPassword('ouder2@example.com');

  const listRes = await fetch(baseUrl + '/api/admin/accounts', {
    headers: { 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS },
  });
  const accounts = await listRes.json();
  const account = accounts.find(a => a.email === 'ouder2@example.com');
  assert.ok(account.resetToken, 'account moet een resetToken hebben');

  const shortRes = await fetch(baseUrl + '/api/parent/set-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: account.resetToken, newPassword: 'kort' }),
  });
  assert.equal(shortRes.status, 400, 'te kort wachtwoord moet geweigerd worden');

  const okRes = await fetch(baseUrl + '/api/parent/set-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: account.resetToken, newPassword: 'NieuwWachtwoord123' }),
  });
  assert.equal(okRes.status, 200);

  const loginRes = await fetch(baseUrl + '/api/verify-parent', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ouder2@example.com', password: 'NieuwWachtwoord123' }),
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.equal(loginData.mustChangePassword, false);

  const reuseRes = await fetch(baseUrl + '/api/parent/set-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: account.resetToken, newPassword: 'NogEenWachtwoord123' }),
  });
  assert.equal(reuseRes.status, 400, 'een al gebruikt token mag niet opnieuw werken');
});

test('Wachtwoord vergeten geeft altijd hetzelfde antwoord, ook voor een onbekend e-mailadres', async () => {
  const res = await fetch(baseUrl + '/api/parent/forgot-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bestaat-niet@example.com' }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
});
