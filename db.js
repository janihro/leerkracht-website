// SQLite datalaag — vervangt de losse JSON-bestanden in /data.
// Gebruikt de ingebouwde node:sqlite module (geen native dependency, geen build-stap nodig).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    siteName TEXT, slogan TEXT, email TEXT, telefoon TEXT, whatsapp TEXT,
    adres TEXT, openingstijden TEXT, instagram TEXT, facebook TEXT, tiktok TEXT
  );
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY, lessonId TEXT, lessonTitle TEXT, question TEXT,
    askedBy TEXT, childName TEXT, timestamp TEXT, answer TEXT, answeredAt TEXT
  );
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY, title TEXT, description TEXT, vak TEXT,
    originalName TEXT, storedName TEXT, mimetype TEXT, size INTEGER,
    url TEXT, uploadedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY, voornaam TEXT, achternaam TEXT, email TEXT, telefoon TEXT,
    kindNaam TEXT, leeftijd TEXT, vak TEXT, bericht TEXT, status TEXT, submittedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY, name TEXT, role TEXT, rating INTEGER, text TEXT, submittedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, email TEXT UNIQUE, password TEXT, kindNaam TEXT, name TEXT,
    mustChangePassword INTEGER, createdAt TEXT
  );
  CREATE TABLE IF NOT EXISTS gallery (
    id TEXT PRIMARY KEY, title TEXT, description TEXT, storedName TEXT, url TEXT, uploadedAt TEXT
  );
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, naam TEXT, beschrijving TEXT, prijs REAL, badge TEXT, badgeKleur TEXT,
    categorie TEXT, icon TEXT, afbeelding TEXT, actief INTEGER, volgorde INTEGER, createdAt TEXT
  );
  CREATE TABLE IF NOT EXISTS agenda (
    id TEXT PRIMARY KEY, titel TEXT, beschrijving TEXT, datum TEXT, tijd TEXT, eindtijd TEXT,
    type TEXT, zichtbaar TEXT, gebruikers TEXT, kleur TEXT, createdAt TEXT
  );
  CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY, name TEXT, username TEXT UNIQUE, password TEXT,
    permissions TEXT, active INTEGER, createdAt TEXT
  );
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY, username TEXT UNIQUE, displayName TEXT, password TEXT,
    isSuperAdmin INTEGER, twoFactorSecret TEXT, twoFactorEnabled INTEGER, createdAt TEXT
  );
`;

function generateId() { return crypto.randomBytes(8).toString('hex'); }

function openDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  // node:sqlite weigert `undefined` als bind-parameter (in tegenstelling tot
  // ontbrekende/hernoemde velden in oude JSON-records, die dat wél opleveren).
  // Zet elke .run()-aanroep hier eenmalig om zodat undefined altijd null wordt.
  const rawPrepare = db.prepare.bind(db);
  db.prepare = sql => {
    const stmt = rawPrepare(sql);
    const rawRun = stmt.run.bind(stmt);
    stmt.run = (...args) => rawRun(...args.map(a => a === undefined ? null : a));
    return stmt;
  };
  return db;
}

// ─── Helpers voor JSON-array kolommen (permissions, gebruikers) ──
function toJson(v) { return JSON.stringify(v || []); }
function fromJson(v) { try { return JSON.parse(v || '[]'); } catch { return []; } }

function buildRepo(db) {
  const questions = {
    all() { return db.prepare('SELECT * FROM questions ORDER BY timestamp DESC').all(); },
    byEmail(email) { return db.prepare('SELECT * FROM questions WHERE askedBy = ? ORDER BY timestamp DESC').all(email); },
    find(id) { return db.prepare('SELECT * FROM questions WHERE id = ?').get(id); },
    insert(q) {
      db.prepare(`INSERT INTO questions (id,lessonId,lessonTitle,question,askedBy,childName,timestamp,answer,answeredAt)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(q.id, q.lessonId, q.lessonTitle, q.question, q.askedBy, q.childName, q.timestamp, q.answer, q.answeredAt);
      return q;
    },
    answer(id, answer, answeredAt) {
      db.prepare('UPDATE questions SET answer = ?, answeredAt = ? WHERE id = ?').run(answer, answeredAt, id);
      return this.find(id);
    },
    remove(id) { db.prepare('DELETE FROM questions WHERE id = ?').run(id); },
  };

  const files = {
    all(vak) {
      const rows = vak
        ? db.prepare('SELECT * FROM files WHERE vak = ? ORDER BY uploadedAt DESC').all(vak)
        : db.prepare('SELECT * FROM files ORDER BY uploadedAt DESC').all();
      return rows;
    },
    count() { return db.prepare('SELECT COUNT(*) AS n FROM files').get().n; },
    find(id) { return db.prepare('SELECT * FROM files WHERE id = ?').get(id); },
    insert(f) {
      db.prepare(`INSERT INTO files (id,title,description,vak,originalName,storedName,mimetype,size,url,uploadedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(f.id, f.title, f.description, f.vak, f.originalName, f.storedName, f.mimetype, f.size, f.url, f.uploadedAt);
      return f;
    },
    remove(id) { db.prepare('DELETE FROM files WHERE id = ?').run(id); },
  };

  const registrations = {
    all() { return db.prepare('SELECT * FROM registrations ORDER BY submittedAt DESC').all(); },
    find(id) { return db.prepare('SELECT * FROM registrations WHERE id = ?').get(id); },
    insert(r) {
      db.prepare(`INSERT INTO registrations (id,voornaam,achternaam,email,telefoon,kindNaam,leeftijd,vak,bericht,status,submittedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(r.id, r.voornaam, r.achternaam, r.email, r.telefoon, r.kindNaam, r.leeftijd, r.vak, r.bericht, r.status, r.submittedAt);
      return r;
    },
    setStatus(id, status) {
      db.prepare('UPDATE registrations SET status = ? WHERE id = ?').run(status, id);
      return this.find(id);
    },
    remove(id) { db.prepare('DELETE FROM registrations WHERE id = ?').run(id); },
  };

  const reviews = {
    all() { return db.prepare('SELECT * FROM reviews ORDER BY submittedAt DESC').all(); },
    insert(r) {
      db.prepare('INSERT INTO reviews (id,name,role,rating,text,submittedAt) VALUES (?,?,?,?,?,?)')
        .run(r.id, r.name, r.role, r.rating, r.text, r.submittedAt);
      return r;
    },
    remove(id) { db.prepare('DELETE FROM reviews WHERE id = ?').run(id); },
  };

  function mapAccount(row) {
    if (!row) return row;
    return { ...row, mustChangePassword: !!row.mustChangePassword };
  }
  const accounts = {
    all() { return db.prepare('SELECT * FROM accounts ORDER BY createdAt DESC').all().map(mapAccount); },
    count() { return db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n; },
    findByEmail(email) { return mapAccount(db.prepare('SELECT * FROM accounts WHERE email = ?').get(email)); },
    insert(a) {
      db.prepare(`INSERT INTO accounts (id,email,password,kindNaam,name,mustChangePassword,createdAt)
        VALUES (?,?,?,?,?,?,?)`).run(a.id, a.email, a.password, a.kindNaam, a.name, a.mustChangePassword ? 1 : 0, a.createdAt);
      return mapAccount(a);
    },
    updatePassword(email, hashed) {
      db.prepare('UPDATE accounts SET password = ?, mustChangePassword = 0 WHERE email = ?').run(hashed, email);
    },
    setPasswordRaw(id, hashed) { db.prepare('UPDATE accounts SET password = ? WHERE id = ?').run(hashed, id); },
    remove(id) { db.prepare('DELETE FROM accounts WHERE id = ?').run(id); },
  };

  const gallery = {
    all() { return db.prepare('SELECT * FROM gallery ORDER BY uploadedAt DESC').all(); },
    find(id) { return db.prepare('SELECT * FROM gallery WHERE id = ?').get(id); },
    insert(g) {
      db.prepare('INSERT INTO gallery (id,title,description,storedName,url,uploadedAt) VALUES (?,?,?,?,?,?)')
        .run(g.id, g.title, g.description, g.storedName, g.url, g.uploadedAt);
      return g;
    },
    update(id, patch) {
      const cur = this.find(id);
      if (!cur) return null;
      const next = { ...cur, ...patch };
      db.prepare('UPDATE gallery SET title = ?, description = ? WHERE id = ?').run(next.title, next.description, id);
      return this.find(id);
    },
    remove(id) { db.prepare('DELETE FROM gallery WHERE id = ?').run(id); },
  };

  function mapProduct(row) {
    if (!row) return row;
    return { ...row, actief: !!row.actief };
  }
  const products = {
    all() { return db.prepare('SELECT * FROM products ORDER BY volgorde ASC, createdAt ASC').all().map(mapProduct); },
    count() { return db.prepare('SELECT COUNT(*) AS n FROM products').get().n; },
    find(id) { return mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)); },
    insert(p) {
      db.prepare(`INSERT INTO products (id,naam,beschrijving,prijs,badge,badgeKleur,categorie,icon,afbeelding,actief,volgorde,createdAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        p.id, p.naam, p.beschrijving, p.prijs, p.badge, p.badgeKleur, p.categorie, p.icon,
        p.afbeelding, p.actief === false ? 0 : 1, p.volgorde || 0, p.createdAt
      );
      return mapProduct(p);
    },
    update(id, patch) {
      const cur = this.find(id);
      if (!cur) return null;
      const n = { ...cur, ...patch };
      db.prepare(`UPDATE products SET naam=?, beschrijving=?, prijs=?, badge=?, badgeKleur=?, categorie=?, icon=?, afbeelding=?, actief=?, volgorde=? WHERE id=?`)
        .run(n.naam, n.beschrijving, n.prijs, n.badge, n.badgeKleur, n.categorie, n.icon, n.afbeelding, n.actief ? 1 : 0, n.volgorde, id);
      return this.find(id);
    },
    remove(id) { db.prepare('DELETE FROM products WHERE id = ?').run(id); },
  };

  function mapAgenda(row) {
    if (!row) return row;
    return { ...row, gebruikers: fromJson(row.gebruikers) };
  }
  const agenda = {
    all() { return db.prepare('SELECT * FROM agenda').all().map(mapAgenda); },
    find(id) { return mapAgenda(db.prepare('SELECT * FROM agenda WHERE id = ?').get(id)); },
    insert(a) {
      db.prepare(`INSERT INTO agenda (id,titel,beschrijving,datum,tijd,eindtijd,type,zichtbaar,gebruikers,kleur,createdAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        a.id, a.titel, a.beschrijving, a.datum, a.tijd, a.eindtijd, a.type, a.zichtbaar, toJson(a.gebruikers), a.kleur, a.createdAt
      );
      return mapAgenda({ ...a });
    },
    update(id, patch) {
      const cur = this.find(id);
      if (!cur) return null;
      const n = { ...cur, ...patch };
      db.prepare(`UPDATE agenda SET titel=?, beschrijving=?, datum=?, tijd=?, eindtijd=?, type=?, zichtbaar=?, gebruikers=?, kleur=? WHERE id=?`)
        .run(n.titel, n.beschrijving, n.datum, n.tijd, n.eindtijd, n.type, n.zichtbaar, toJson(n.gebruikers), n.kleur, id);
      return this.find(id);
    },
    remove(id) { db.prepare('DELETE FROM agenda WHERE id = ?').run(id); },
  };

  function mapTeacher(row) {
    if (!row) return row;
    return { ...row, permissions: fromJson(row.permissions), active: !!row.active };
  }
  const teachers = {
    all() { return db.prepare('SELECT * FROM teachers ORDER BY createdAt ASC').all().map(mapTeacher); },
    find(id) { return mapTeacher(db.prepare('SELECT * FROM teachers WHERE id = ?').get(id)); },
    findByUsername(username) { return mapTeacher(db.prepare('SELECT * FROM teachers WHERE username = ?').get(username)); },
    insert(t) {
      db.prepare(`INSERT INTO teachers (id,name,username,password,permissions,active,createdAt) VALUES (?,?,?,?,?,?,?)`)
        .run(t.id, t.name, t.username, t.password, toJson(t.permissions), t.active === false ? 0 : 1, t.createdAt);
      return mapTeacher({ ...t });
    },
    update(id, patch) {
      const cur = this.find(id);
      if (!cur) return null;
      const n = { ...cur, ...patch };
      db.prepare('UPDATE teachers SET name=?, username=?, password=?, permissions=?, active=? WHERE id=?')
        .run(n.name, n.username, n.password, toJson(n.permissions), n.active ? 1 : 0, id);
      return this.find(id);
    },
    remove(id) { db.prepare('DELETE FROM teachers WHERE id = ?').run(id); },
  };

  function mapAdmin(row) {
    if (!row) return row;
    return { ...row, isSuperAdmin: !!row.isSuperAdmin, twoFactorEnabled: !!row.twoFactorEnabled };
  }
  const admins = {
    all() { return db.prepare('SELECT * FROM admins ORDER BY createdAt ASC').all().map(mapAdmin); },
    find(id) { return mapAdmin(db.prepare('SELECT * FROM admins WHERE id = ?').get(id)); },
    findByUsername(username) { return mapAdmin(db.prepare('SELECT * FROM admins WHERE username = ?').get(username)); },
    count() { return db.prepare('SELECT COUNT(*) AS n FROM admins').get().n; },
    insert(a) {
      db.prepare(`INSERT INTO admins (id,username,displayName,password,isSuperAdmin,twoFactorSecret,twoFactorEnabled,createdAt)
        VALUES (?,?,?,?,?,?,?,?)`).run(
        a.id, a.username, a.displayName, a.password, a.isSuperAdmin ? 1 : 0,
        a.twoFactorSecret || null, a.twoFactorEnabled ? 1 : 0, a.createdAt
      );
      return mapAdmin({ ...a });
    },
    updatePassword(id, hashed) { db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hashed, id); },
    setTwoFactor(id, secret, enabled) {
      db.prepare('UPDATE admins SET twoFactorSecret = ?, twoFactorEnabled = ? WHERE id = ?').run(secret, enabled ? 1 : 0, id);
    },
    remove(id) { db.prepare('DELETE FROM admins WHERE id = ?').run(id); },
  };

  const DEFAULT_SETTINGS = {
    siteName: 'NONF', slogan: 'Nos Orguyo, Nos Futuro',
    email: 'info@nosorguyonosfuturo.nl', telefoon: '0681 52 99 64', whatsapp: '31681529964',
    adres: 'Almere Poort & Amsterdam Zuidoost', openingstijden: 'Ma–vr: 9:00–19:00 · Za: 10:00–14:00',
    instagram: '#', facebook: '#', tiktok: '#',
  };
  const settings = {
    get() {
      const row = db.prepare('SELECT * FROM settings WHERE id = 1').get();
      if (!row) return { ...DEFAULT_SETTINGS };
      const { id, ...rest } = row;
      return rest;
    },
    ensureDefaults() {
      if (!db.prepare('SELECT id FROM settings WHERE id = 1').get()) {
        const s = DEFAULT_SETTINGS;
        db.prepare(`INSERT INTO settings (id,siteName,slogan,email,telefoon,whatsapp,adres,openingstijden,instagram,facebook,tiktok)
          VALUES (1,?,?,?,?,?,?,?,?,?,?)`).run(
          s.siteName, s.slogan, s.email, s.telefoon, s.whatsapp, s.adres, s.openingstijden, s.instagram, s.facebook, s.tiktok
        );
      }
    },
    update(patch) {
      const cur = this.get();
      const n = { ...cur, ...patch };
      db.prepare(`UPDATE settings SET siteName=?, slogan=?, email=?, telefoon=?, whatsapp=?, adres=?, openingstijden=?, instagram=?, facebook=?, tiktok=? WHERE id=1`)
        .run(n.siteName, n.slogan, n.email, n.telefoon, n.whatsapp, n.adres, n.openingstijden, n.instagram, n.facebook, n.tiktok);
      return this.get();
    },
  };
  settings.ensureDefaults();

  return { questions, files, registrations, reviews, accounts, gallery, products, agenda, teachers, admins, settings };
}

// Seed standaard NONF-producten — alleen aanroepen als de tabel na een
// eventuele migratie nog steeds leeg is (dus NOOIT vóór migrate-json-to-sqlite
// de kans heeft gehad om bestaande producten over te zetten).
function seedDefaultProductsIfEmpty(repo) {
  if (repo.products.count() > 0) return;
  const seed = [
    { naam: 'Werkboek Papiamentu Basis (0–3 jr)', beschrijving: 'Leer de eerste woorden, kleuren en cijfers in Papiamentu. Kleurrijk werkboek voor de allerkleinsten.', prijs: 14.95, categorie: 'werkboeken', icon: 'fa-book', volgorde: 1 },
    { naam: 'Werkboek Papiamentu Middenbouw (4–7 jr)', beschrijving: 'Zinnen, verhalen en oefeningen in Papiamentu voor kinderen van 4 tot 7 jaar.', prijs: 17.95, categorie: 'werkboeken', icon: 'fa-book-open', volgorde: 2 },
    { naam: 'Werkboek Papiamentu Gevorderd (8–12 jr)', beschrijving: 'Grammatica, cultuur en uitdrukkingen. Voor kinderen die al basis Papiamentu kennen.', prijs: 19.95, categorie: 'werkboeken', icon: 'fa-graduation-cap', volgorde: 3 },
    { naam: 'Flashcards Papiamentu (50 kaartjes)', beschrijving: '50 woord-/afbeeldingskaartjes om thuis mee te oefenen. Ideaal als aanvulling op de lessen.', prijs: 9.95, categorie: 'leermateriaal', icon: 'fa-layer-group', volgorde: 4 },
    { naam: 'NONF T-shirt (kinderen)', beschrijving: '"Nos Orguyo, Nos Futuro" — Draag de trots van de ABC-eilanden. Maten: 104 t/m 152.', prijs: 19.95, categorie: 'merchandise', icon: 'fa-tshirt', volgorde: 5 },
    { naam: 'NONF Tote Bag', beschrijving: 'Stoffen draagtas met NONF logo. Duurzaam, herbruikbaar en stijlvol.', prijs: 12.95, categorie: 'merchandise', icon: 'fa-shopping-bag', volgorde: 6 },
  ];
  seed.forEach(p => repo.products.insert({
    id: generateId(), badge: null, badgeKleur: null, afbeelding: null, actief: true,
    createdAt: new Date().toISOString(), ...p,
  }));
}

module.exports = { openDb, buildRepo, seedDefaultProductsIfEmpty, generateId };
