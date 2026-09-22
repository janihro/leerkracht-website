const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, waitForServer } = require('./helpers');

// Het ouderportaal vertrouwde het e-mailadres uit de URL: wie andermans adres
// kende, kon diens vragen, agenda en notities opvragen. Sinds deze wijziging
// bepaalt een sessietoken wie je bent. Deze tests leggen zowel de dichtgezette
// route vast als het gedrag dat moest blijven werken (docent en beheerder).

const PORT = 5107;
const ADMIN = { username: 'beheerder', password: 'testadmin123' };
const OUDER_A = { email: 'ouder-a@example.com', password: 'wachtwoordA1', kindNaam: 'Kind A' };
const OUDER_B = { email: 'ouder-b@example.com', password: 'wachtwoordB1', kindNaam: 'Kind B' };
const DOCENT = { username: 'portaaldocent', password: 'wachtwoord123' };

let baseUrl, server;
let tokenA = '', tokenB = '', accountIdB = '';

const adminHeaders = (extra) => ({
  'Content-Type': 'application/json',
  'x-admin-username': ADMIN.username,
  'x-admin-password': ADMIN.password,
  ...extra,
});
const docentHeaders = (extra) => ({
  'x-teacher-username': DOCENT.username,
  'x-teacher-password': DOCENT.password,
  ...extra,
});

async function maakAccount(ouder) {
  const res = await fetch(baseUrl + '/api/admin/accounts', {
    method: 'POST', headers: adminHeaders(),
    body: JSON.stringify({ email: ouder.email, password: ouder.password, kindNaam: ouder.kindNaam, name: ouder.kindNaam }),
  });
  assert.equal(res.status, 201, 'account aanmaken moet lukken');
  return (await res.json()).id;
}

async function login(ouder) {
  const res = await fetch(baseUrl + '/api/verify-parent', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ouder.email, password: ouder.password }),
  });
  assert.equal(res.status, 200);
  return await res.json();
}

test.before(async () => {
  ({ baseUrl, server } = startServer({ port: PORT, adminPassword: ADMIN.password }));
  await waitForServer(baseUrl);

  await maakAccount(OUDER_A);
  accountIdB = await maakAccount(OUDER_B);

  const docentRes = await fetch(baseUrl + '/api/admin/teachers', {
    method: 'POST', headers: adminHeaders(),
    body: JSON.stringify({
      name: 'Portaal Docent', username: DOCENT.username, password: DOCENT.password,
      permissions: ['vragen', 'notities', 'agenda'],
    }),
  });
  assert.equal(docentRes.status, 201);

  tokenA = (await login(OUDER_A)).sessionToken;
  tokenB = (await login(OUDER_B)).sessionToken;

  // Een notitie over kind B, om te bewijzen dat ouder A daar niet bij kan.
  const notitieRes = await fetch(baseUrl + '/api/notities', {
    method: 'POST', headers: docentHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ accountId: accountIdB, titel: 'Prive over kind B', tekst: 'Vertrouwelijk' }),
  });
  assert.equal(notitieRes.status, 201);

  // Elke ouder stelt een vraag.
  for (const [token, vraag] of [[tokenA, 'Vraag van ouder A'], [tokenB, 'Vraag van ouder B']]) {
    const res = await fetch(baseUrl + '/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-parent-session': token },
      body: JSON.stringify({ lessonId: 'les1', question: vraag }),
    });
    assert.equal(res.status, 201);
  }
});

test.after(() => server.close());

test('Inloggen geeft een sessietoken terug', async () => {
  const data = await login(OUDER_A);
  assert.ok(data.sessionToken, 'login hoort een sessietoken mee te geven');
  assert.equal(data.kindNaam, OUDER_A.kindNaam);
});

test('Een ouder ziet met een geldig token alleen de eigen vragen', async () => {
  const res = await fetch(baseUrl + '/api/questions', { headers: { 'x-parent-session': tokenA } });
  assert.equal(res.status, 200);
  const vragen = await res.json();
  assert.ok(vragen.length >= 1);
  assert.ok(vragen.every(v => v.askedBy === OUDER_A.email), 'mag uitsluitend eigen vragen bevatten');
});

test('Zonder token geven vragen en notities geen gegevens meer', async () => {
  for (const pad of ['/api/questions', '/api/notities']) {
    const res = await fetch(baseUrl + pad);
    assert.equal(res.status, 401, `${pad} hoort zonder token geweigerd te worden`);
  }
  // De agenda toont zonder token nog wel de items die voor iedereen bedoeld
  // zijn, maar geen persoonlijke items.
  const agenda = await fetch(baseUrl + '/api/agenda');
  assert.equal(agenda.status, 200);
  assert.ok((await agenda.json()).every(i => i.zichtbaar === 'iedereen'));
});

test('DE KWETSBAARHEID: andermans e-mailadres in de URL levert niets meer op', async () => {
  for (const pad of [
    `/api/questions?email=${encodeURIComponent(OUDER_B.email)}`,
    `/api/notities?email=${encodeURIComponent(OUDER_B.email)}`,
  ]) {
    const res = await fetch(baseUrl + pad);
    assert.equal(res.status, 401, `${pad} gaf voorheen de gegevens van een ander terug`);
  }
});

test('Een ingelogde ouder kan via de URL evenmin bij gegevens van een ander', async () => {
  const vragen = await fetch(
    `${baseUrl}/api/questions?email=${encodeURIComponent(OUDER_B.email)}`,
    { headers: { 'x-parent-session': tokenA } },
  );
  assert.equal(vragen.status, 200);
  assert.ok((await vragen.json()).every(v => v.askedBy === OUDER_A.email), 'e-mailadres uit de URL moet genegeerd worden');

  const notities = await fetch(
    `${baseUrl}/api/notities?email=${encodeURIComponent(OUDER_B.email)}`,
    { headers: { 'x-parent-session': tokenA } },
  );
  assert.equal(notities.status, 200);
  assert.deepEqual(await notities.json(), [], 'ouder A hoort geen notities over kind B te zien');
});

test('Een ouder kan geen vraag plaatsen namens iemand anders', async () => {
  const res = await fetch(baseUrl + '/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-parent-session': tokenA },
    body: JSON.stringify({ lessonId: 'les1', question: 'Stiekem namens B', askedBy: OUDER_B.email, childName: 'Kind B' }),
  });
  assert.equal(res.status, 201);
  const vraag = await res.json();
  assert.equal(vraag.askedBy, OUDER_A.email, 'afzender komt uit de sessie, niet uit de body');
  assert.equal(vraag.childName, OUDER_A.kindNaam);
});

test('Vragen stellen zonder geldige sessie wordt geweigerd', async () => {
  const res = await fetch(baseUrl + '/api/questions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId: 'les1', question: 'Anonieme vraag', askedBy: 'vreemde@example.com' }),
  });
  assert.equal(res.status, 401);
});

test('MOET BLIJVEN WERKEN: docent met het recht vragen ziet alle vragen', async () => {
  const res = await fetch(baseUrl + '/api/questions', { headers: docentHeaders() });
  assert.equal(res.status, 200);
  const vragen = await res.json();
  assert.ok(vragen.some(v => v.askedBy === OUDER_A.email));
  assert.ok(vragen.some(v => v.askedBy === OUDER_B.email), 'docent hoort alle ouders te zien');
});

test('MOET BLIJVEN WERKEN: docent en beheerder kunnen notities en agenda ophalen', async () => {
  const notities = await fetch(baseUrl + '/api/notities', { headers: docentHeaders() });
  assert.equal(notities.status, 200);
  assert.ok((await notities.json()).length >= 1);

  const agenda = await fetch(baseUrl + '/api/agenda', { headers: docentHeaders() });
  assert.equal(agenda.status, 200);

  const beheerder = await fetch(baseUrl + '/api/questions', {
    headers: { 'x-admin-username': ADMIN.username, 'x-admin-password': ADMIN.password },
  });
  assert.equal(beheerder.status, 200);
});

test('Uitloggen maakt het sessietoken onbruikbaar', async () => {
  const eigen = (await login(OUDER_B)).sessionToken;
  const voor = await fetch(baseUrl + '/api/questions', { headers: { 'x-parent-session': eigen } });
  assert.equal(voor.status, 200);

  const uit = await fetch(baseUrl + '/api/parent/logout', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken: eigen }),
  });
  assert.equal(uit.status, 200);

  const na = await fetch(baseUrl + '/api/questions', { headers: { 'x-parent-session': eigen } });
  assert.equal(na.status, 401, 'na uitloggen mag het token niets meer opleveren');
});

test('Een verzonnen token werkt niet', async () => {
  const res = await fetch(baseUrl + '/api/questions', { headers: { 'x-parent-session': 'niet-echt' } });
  assert.equal(res.status, 401);
});
