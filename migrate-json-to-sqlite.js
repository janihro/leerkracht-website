// Eenmalige migratie: leest de bestaande JSON-bestanden in DATA_DIR en zet ze
// over naar de nieuwe SQLite-database. Idempotent — slaat over als de
// admins-tabel al gevuld is (dan is er al eerder gemigreerd).
// De originele JSON-bestanden worden hernoemd naar *.migrated.bak (niet verwijderd).
const fs = require('fs');
const path = require('path');
const { openDb, buildRepo, seedDefaultProductsIfEmpty } = require('./db');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function migrate(DATA_DIR) {
  const dbPath = path.join(DATA_DIR, 'nonf.sqlite');
  const db = openDb(dbPath);
  const repo = buildRepo(db);

  const alreadyMigrated = repo.admins.count() > 0 || repo.accounts.count() > 0
    || repo.registrations.all().length > 0 || repo.teachers.all().length > 0;
  if (alreadyMigrated) {
    console.log('ℹ️  SQLite bevat al data — migratie wordt overgeslagen.');
    seedDefaultProductsIfEmpty(repo);
    return { db, repo, migrated: false };
  }

  const files = {
    questions:     path.join(DATA_DIR, 'questions.json'),
    files:         path.join(DATA_DIR, 'files.json'),
    registrations: path.join(DATA_DIR, 'registrations.json'),
    reviews:       path.join(DATA_DIR, 'reviews.json'),
    accounts:      path.join(DATA_DIR, 'accounts.json'),
    gallery:       path.join(DATA_DIR, 'gallery.json'),
    products:      path.join(DATA_DIR, 'products.json'),
    agenda:        path.join(DATA_DIR, 'agenda.json'),
    teachers:      path.join(DATA_DIR, 'teachers.json'),
    admins:        path.join(DATA_DIR, 'admins.json'),
    settings:      path.join(DATA_DIR, 'settings.json'),
  };

  const anyExists = Object.values(files).some(f => fs.existsSync(f));
  if (!anyExists) {
    console.log('ℹ️  Geen oude JSON-bestanden gevonden — schone start met SQLite.');
    seedDefaultProductsIfEmpty(repo);
    return { db, repo, migrated: false };
  }

  console.log('🔄 Migreren van JSON naar SQLite...');
  let count = 0;

  const q = readJSON(files.questions);
  (q?.questions || []).forEach(x => { repo.questions.insert(x); count++; });

  const f = readJSON(files.files);
  (f?.files || []).forEach(x => { repo.files.insert(x); count++; });

  const r = readJSON(files.registrations);
  (r?.registrations || []).forEach(x => {
    // Oudere records gebruikten nog "leerjaar" i.p.v. "leeftijd"
    repo.registrations.insert({ ...x, leeftijd: x.leeftijd || x.leerjaar || null });
    count++;
  });

  const rv = readJSON(files.reviews);
  (rv?.reviews || []).forEach(x => { repo.reviews.insert(x); count++; });

  const acc = readJSON(files.accounts);
  (acc?.accounts || []).forEach(x => { repo.accounts.insert(x); count++; });

  const gal = readJSON(files.gallery);
  (gal?.items || []).forEach(x => { repo.gallery.insert(x); count++; });

  const prod = readJSON(files.products);
  (prod?.products || []).forEach(x => { repo.products.insert(x); count++; });
  // Alleen als er geen producten.json was, vult seedDefaultProductsIfEmpty
  // straks de standaard NONF-producten in (de tabel is dan nog leeg).

  const ag = readJSON(files.agenda);
  (ag?.items || []).forEach(x => { repo.agenda.insert(x); count++; });

  const tch = readJSON(files.teachers);
  (tch?.teachers || []).forEach(x => { repo.teachers.insert(x); count++; });

  const adm = readJSON(files.admins);
  (adm?.admins || []).forEach(x => { repo.admins.insert(x); count++; });

  const set = readJSON(files.settings);
  if (set) { repo.settings.update(set); }

  seedDefaultProductsIfEmpty(repo); // vult standaardproducten in als er geen products.json was

  // Backup: hernoem originele bestanden zodat migratie niet dubbel draait
  Object.values(files).forEach(f => {
    if (fs.existsSync(f)) fs.renameSync(f, f + '.migrated.bak');
  });

  console.log(`✅ Migratie voltooid — ${count} records overgezet naar SQLite.`);
  return { db, repo, migrated: true };
}

module.exports = { migrate };
