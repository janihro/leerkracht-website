const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// De bug die Angeline meldde zat niet in de server maar in docent.html: een
// paar aanroepen stuurden het docentwachtwoord mee zonder gebruikersnaam.
// De server weigert dat (zie getTeacher), waarna het paneel de docent uitlogde
// met "Sessie verlopen". Een servertest kan dat niet vangen, dus controleert
// deze test de frontend-bron zelf: overal waar inloggegevens meegaan, moet de
// gebruikersnaam erbij staan.

const BRON = path.join(__dirname, '..', 'docent.html');

test('Elke aanroep in het docentenpaneel stuurt de gebruikersnaam mee naast het wachtwoord', () => {
  const regels = fs.readFileSync(BRON, 'utf8').split(/\r?\n/);
  const fouten = [];

  regels.forEach((regel, i) => {
    const schoon = regel.trim();
    // Alleen regels die daadwerkelijk inloggegevens meesturen in een verzoek.
    const stuurtWachtwoord =
      /'x-teacher-password'/.test(schoon) ||
      /teacherPassword['"]?\s*[:,]/.test(schoon) ||
      /append\(['"]teacherPassword['"]/.test(schoon);
    if (!stuurtWachtwoord) return;

    // De gebruikersnaam mag op dezelfde regel staan of op de regel direct
    // ernaast (bij FormData wordt hij op een eigen regel toegevoegd).
    const context = [regels[i - 1] || '', regel, regels[i + 1] || ''].join('\n');
    if (!/teacherUser|teacherUsername|x-teacher-username/.test(context)) {
      fouten.push(`regel ${i + 1}: ${schoon.slice(0, 100)}`);
    }
  });

  assert.deepEqual(
    fouten, [],
    'Deze aanroepen sturen het wachtwoord zonder gebruikersnaam en loggen de docent dus uit:\n' + fouten.join('\n')
  );
});

test('Het paneel bevat geen dubbele x-teacher-username header', () => {
  const bron = fs.readFileSync(BRON, 'utf8');
  const dubbel = bron.split(/\r?\n/).filter(r => /x-teacher-username[\s\S]*x-teacher-username/.test(r));
  assert.deepEqual(dubbel.map(r => r.trim().slice(0, 80)), []);
});
