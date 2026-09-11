const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, waitForServer } = require('./helpers');

const PORT = 5101;
let baseUrl, server;

test.before(async () => {
  ({ baseUrl, server } = startServer({ port: PORT }));
  await waitForServer(baseUrl);
});

test.after(() => server.close());

test('POST /api/registrations maakt een inschrijving aan met geldige gegevens', async () => {
  const res = await fetch(baseUrl + '/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      voornaam: 'Test', achternaam: 'Persoon', email: 'test@example.com',
      kindNaam: 'Kindje', leeftijd: '4-12 jaar', vak: 'Papiamentu',
    }),
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.voornaam, 'Test');
  assert.equal(data.status, 'nieuw');
  assert.ok(data.id);
});

test('POST /api/registrations weigert zonder verplichte velden', async () => {
  const res = await fetch(baseUrl + '/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voornaam: 'Test' }),
  });
  assert.equal(res.status, 400);
});

test('POST /api/registrations weigert een ongeldig e-mailadres', async () => {
  const res = await fetch(baseUrl + '/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voornaam: 'Test', email: 'geen-email', kindNaam: 'Kind' }),
  });
  assert.equal(res.status, 400);
});
