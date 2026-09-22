const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, waitForServer } = require('./helpers');

// Regressietest voor de bug die Angeline meldde: het docentenpaneel stuurt bij
// acties (status wijzigen, verwijderen, vraag beantwoorden) de inloggegevens in
// de body mee i.p.v. in headers. De gebruikersnaam ontbrak daar, waardoor de
// server 401 gaf en het paneel de docent uitlogde met "Sessie verlopen".
// Deze tests gebruiken daarom bewust body-gegevens, precies zoals het paneel.

const PORT = 5106;
const ADMIN_PASS = 'testadmin123';
const DOCENT = { username: 'actiedocent', password: 'wachtwoord123' };
let baseUrl, server;

test.before(async () => {
  ({ baseUrl, server } = startServer({ port: PORT, adminPassword: ADMIN_PASS }));
  await waitForServer(baseUrl);
  const res = await fetch(baseUrl + '/api/admin/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS },
    body: JSON.stringify({
      name: 'Actie Docent', username: DOCENT.username, password: DOCENT.password,
      permissions: ['inschrijvingen', 'vragen'],
    }),
  });
  assert.equal(res.status, 201);
});

test.after(() => server.close());

async function nieuweInschrijving(kindNaam) {
  const res = await fetch(baseUrl + '/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voornaam: 'Test', achternaam: 'Ouder', email: 'ouder@example.com', kindNaam }),
  });
  assert.equal(res.status, 201);
  return (await res.json()).id;
}

test('Docent kan de status van een inschrijving wijzigen met gegevens in de body', async () => {
  const id = await nieuweInschrijving('Statuskind');
  const res = await fetch(`${baseUrl}/api/registrations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teacherUsername: DOCENT.username,
      teacherPassword: DOCENT.password,
      status: 'contact opgenomen',
    }),
  });
  assert.equal(res.status, 200, 'status wijzigen mag de docent niet uitloggen');
  assert.equal((await res.json()).status, 'contact opgenomen');
});

test('Docent kan een inschrijving verwijderen met gegevens in de body', async () => {
  const id = await nieuweInschrijving('Verwijderkind');
  const res = await fetch(`${baseUrl}/api/registrations/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherUsername: DOCENT.username, teacherPassword: DOCENT.password }),
  });
  assert.equal(res.status, 200);
});

test('Docent kan een vraag beantwoorden met gegevens in de body', async () => {
  // Vragen stellen kan alleen als ingelogde ouder, dus eerst een portaalaccount
  // aanmaken en daarmee inloggen.
  const accountRes = await fetch(baseUrl + '/api/admin/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-username': 'beheerder', 'x-admin-password': ADMIN_PASS },
    body: JSON.stringify({ email: 'vraagouder@example.com', password: 'ouderpass1', kindNaam: 'Vraagkind' }),
  });
  assert.equal(accountRes.status, 201);
  const loginRes = await fetch(baseUrl + '/api/verify-parent', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vraagouder@example.com', password: 'ouderpass1' }),
  });
  assert.equal(loginRes.status, 200);
  const ouderSessie = (await loginRes.json()).sessionToken;

  const vraagRes = await fetch(baseUrl + '/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-parent-session': ouderSessie },
    body: JSON.stringify({ lessonId: 'les1', question: 'Hoe werkt dit?' }),
  });
  assert.equal(vraagRes.status, 201);
  const vraagId = (await vraagRes.json()).id;

  const res = await fetch(`${baseUrl}/api/questions/${vraagId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      answer: 'Zo werkt het.',
      teacherUsername: DOCENT.username,
      teacherPassword: DOCENT.password,
    }),
  });
  assert.equal(res.status, 200, 'antwoorden mag de docent niet uitloggen');
});

test('Zonder gebruikersnaam weigert de server nog steeds — dit was de oorzaak van de bug', async () => {
  const id = await nieuweInschrijving('Zonderkind');
  const res = await fetch(`${baseUrl}/api/registrations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherPassword: DOCENT.password, status: 'ingeschreven' }),
  });
  assert.equal(res.status, 401);
});
