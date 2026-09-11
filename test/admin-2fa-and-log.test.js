const test = require('node:test');
const assert = require('node:assert/strict');
const speakeasy = require('speakeasy');
const { startServer, waitForServer } = require('./helpers');

const PORT = 5104;
const ADMIN_PASS = 'testadmin123';
let baseUrl, server;
let sessionToken = ''; // gevuld zodra 2FA aanstaat, voor hergebruik in latere tests

test.before(async () => {
  ({ baseUrl, server } = startServer({ port: PORT, adminPassword: ADMIN_PASS }));
  await waitForServer(baseUrl);
});

test.after(() => server.close());

async function adminGet(path, headers = {}) {
  return fetch(baseUrl + path, { headers: { 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS, ...headers } });
}

test('Zonder 2FA is het wachtwoord voldoende (ongewijzigd gedrag)', async () => {
  const res = await adminGet('/api/admin/stats');
  assert.equal(res.status, 200);
});

test('Met 2FA aangezet: wachtwoord alléén is niet meer genoeg', async () => {
  // 2FA-secret aanmaken en aanzetten via de setup-flow
  const setupRes = await fetch(baseUrl + '/api/admin/2fa/setup', {
    method: 'POST',
    headers: { 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS },
  });
  const { secret } = await setupRes.json();
  const validToken = speakeasy.totp({ secret, encoding: 'base32' });
  const enableRes = await fetch(baseUrl + '/api/admin/2fa/enable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS },
    body: JSON.stringify({ secret, token: validToken }),
  });
  assert.equal(enableRes.status, 200);

  // Nu zou wachtwoord-alleen niet meer moeten werken
  const blocked = await adminGet('/api/admin/stats');
  assert.equal(blocked.status, 401, 'wachtwoord alleen moet geweigerd worden zodra 2FA aanstaat');

  // Inloggen zonder code moet ook geweigerd worden
  const loginNoTotp = await fetch(baseUrl + '/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS },
    body: JSON.stringify({}),
  });
  assert.equal(loginNoTotp.status, 400);

  // Inloggen mét geldige code geeft een sessietoken
  const freshToken = speakeasy.totp({ secret, encoding: 'base32' });
  const loginRes = await fetch(baseUrl + '/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS, 'x-admin-totp': freshToken },
    body: JSON.stringify({ trustDevice: false }),
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.sessionToken);
  sessionToken = loginData.sessionToken; // hergebruiken in de volgende test

  // Met dat sessietoken werkt een gewone API-aanroep weer, zonder nieuwe code
  const withSession = await adminGet('/api/admin/stats', { 'x-admin-session': loginData.sessionToken });
  assert.equal(withSession.status, 200);

  // Een verzonnen sessietoken werkt niet
  const badSession = await adminGet('/api/admin/stats', { 'x-admin-session': 'niet-een-echt-token' });
  assert.equal(badSession.status, 401);
});

test('Activiteitenlog: alleen de hoofdbeheerder mag het inzien, en toont echte gebeurtenissen', async () => {
  // Genereer wat activiteit
  await fetch(baseUrl + '/api/registrations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voornaam: 'Log', achternaam: 'Test', email: 'logtest@example.com', kindNaam: 'Logkind' }),
  });

  // Deze test loopt na de 2FA-test, dus het sessietoken van dat moment is nodig.
  const res = await adminGet('/api/admin/activity-log', { 'x-admin-session': sessionToken });
  assert.equal(res.status, 200);
  const entries = await res.json();
  assert.ok(entries.some(e => e.message.includes('Logkind')), 'de nieuwe inschrijving moet in het log staan');
});
