const express   = require('express');
const path      = require('path');
const fs        = require('fs');
const multer    = require('multer');
const crypto    = require('crypto'); // ingebouwd in Node.js
const speakeasy = require('speakeasy');
const QRCode    = require('qrcode');

const app  = express();
const PORT = process.env.PORT || 3000;

const TEACHER_PASS = process.env.TEACHER_PASSWORD || 'leerkracht2026';

// Persistent storage
const DATA_DIR    = process.env.DATA_DIR    || path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
[DATA_DIR, UPLOADS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const QUESTIONS_FILE     = path.join(DATA_DIR, 'questions.json');
const FILES_META         = path.join(DATA_DIR, 'files.json');
const REGISTRATIONS_FILE = path.join(DATA_DIR, 'registrations.json');
const REVIEWS_FILE       = path.join(DATA_DIR, 'reviews.json');
const SETTINGS_FILE      = path.join(DATA_DIR, 'settings.json');
const ACCOUNTS_FILE      = path.join(DATA_DIR, 'accounts.json');
const ADMIN_FILE         = path.join(DATA_DIR, 'admin.json');
const GALLERY_FILE       = path.join(DATA_DIR, 'gallery.json');
const PRODUCTS_FILE      = path.join(DATA_DIR, 'products.json');
const AGENDA_FILE        = path.join(DATA_DIR, 'agenda.json');
const TEACHERS_FILE      = path.join(DATA_DIR, 'teachers.json');
const ADMINS_FILE        = path.join(DATA_DIR, 'admins.json');

const ALL_PERMISSIONS = ['vragen', 'agenda', 'materiaal', 'inschrijvingen', 'galerij'];

// ─── INITIALISEER DATA FILES ──────────────────────────────
if (!fs.existsSync(QUESTIONS_FILE))     fs.writeFileSync(QUESTIONS_FILE,     JSON.stringify({ questions: [] }, null, 2));
if (!fs.existsSync(FILES_META))         fs.writeFileSync(FILES_META,         JSON.stringify({ files: [] }, null, 2));
if (!fs.existsSync(REGISTRATIONS_FILE)) fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify({ registrations: [] }, null, 2));
if (!fs.existsSync(REVIEWS_FILE))       fs.writeFileSync(REVIEWS_FILE,       JSON.stringify({ reviews: [] }, null, 2));
if (!fs.existsSync(ACCOUNTS_FILE))      fs.writeFileSync(ACCOUNTS_FILE,      JSON.stringify({ accounts: [] }, null, 2));
if (!fs.existsSync(GALLERY_FILE))       fs.writeFileSync(GALLERY_FILE,       JSON.stringify({ items: [] }, null, 2));
if (!fs.existsSync(PRODUCTS_FILE))      fs.writeFileSync(PRODUCTS_FILE,      JSON.stringify({ products: [] }, null, 2));
// Seed standaard NONF producten als de lijst leeg is
(function seedProducts() {
  const d = readJSON(PRODUCTS_FILE);
  if (!d.products || d.products.length > 0) return;
  d.products = [
    { id: 'p-seed-1', naam: 'Werkboek Papiamentu Basis (0–3 jr)', beschrijving: 'Leer de eerste woorden, kleuren en cijfers in Papiamentu. Kleurrijk werkboek voor de allerkleinsten.', prijs: 14.95, categorie: 'werkboeken', icon: 'fa-book', actief: true, volgorde: 1, createdAt: new Date().toISOString() },
    { id: 'p-seed-2', naam: 'Werkboek Papiamentu Middenbouw (4–7 jr)', beschrijving: 'Zinnen, verhalen en oefeningen in Papiamentu voor kinderen van 4 tot 7 jaar.', prijs: 17.95, categorie: 'werkboeken', icon: 'fa-book-open', actief: true, volgorde: 2, createdAt: new Date().toISOString() },
    { id: 'p-seed-3', naam: 'Werkboek Papiamentu Gevorderd (8–12 jr)', beschrijving: 'Grammatica, cultuur en uitdrukkingen. Voor kinderen die al basis Papiamentu kennen.', prijs: 19.95, categorie: 'werkboeken', icon: 'fa-graduation-cap', actief: true, volgorde: 3, createdAt: new Date().toISOString() },
    { id: 'p-seed-4', naam: 'Flashcards Papiamentu (50 kaartjes)', beschrijving: '50 woord-/afbeeldingskaartjes om thuis mee te oefenen. Ideaal als aanvulling op de lessen.', prijs: 9.95, categorie: 'leermateriaal', icon: 'fa-layer-group', actief: true, volgorde: 4, createdAt: new Date().toISOString() },
    { id: 'p-seed-5', naam: 'NONF T-shirt (kinderen)', beschrijving: '"Nos Orguyo, Nos Futuro" — Draag de trots van de ABC-eilanden. Maten: 104 t/m 152.', prijs: 19.95, categorie: 'merchandise', icon: 'fa-tshirt', actief: true, volgorde: 5, createdAt: new Date().toISOString() },
    { id: 'p-seed-6', naam: 'NONF Tote Bag', beschrijving: 'Stoffen draagtas met NONF logo. Duurzaam, herbruikbaar en stijlvol.', prijs: 12.95, categorie: 'merchandise', icon: 'fa-shopping-bag', actief: true, volgorde: 6, createdAt: new Date().toISOString() },
  ];
  writeJSON(PRODUCTS_FILE, d);
}());
if (!fs.existsSync(AGENDA_FILE))        fs.writeFileSync(AGENDA_FILE,        JSON.stringify({ items: [] }, null, 2));
if (!fs.existsSync(TEACHERS_FILE))     fs.writeFileSync(TEACHERS_FILE,     JSON.stringify({ teachers: [] }, null, 2));
if (!fs.existsSync(ADMINS_FILE))       fs.writeFileSync(ADMINS_FILE,       JSON.stringify({ admins: [] }, null, 2));
if (!fs.existsSync(SETTINGS_FILE))      fs.writeFileSync(SETTINGS_FILE,      JSON.stringify({
  siteName: 'LeerKracht', slogan: 'Nos Orguyo, Nos Futuro',
  email: 'info@leerkracht.nl', telefoon: '06 — XX XX XX XX', whatsapp: '',
  adres: '[Straatnaam], [Stad]', openingstijden: 'Ma–vr: 9:00–19:00 · Za: 10:00–14:00',
  instagram: '#', facebook: '#', tiktok: '#',
}, null, 2));

// ─── WACHTWOORD HASHING (PBKDF2-SHA512) ──────────────────
// Gebruikt Node.js ingebouwde crypto — geen extra packages
function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}
function verifyPassword(input, stored) {
  if (!input || !stored) return false;
  if (stored.startsWith('pbkdf2:')) {
    const parts = stored.split(':');
    if (parts.length < 3) return false;
    const salt     = parts[1];
    const expected = hashPassword(input, salt);
    // Timing-safe vergelijking — voorkomt timing-aanvallen
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(stored));
    } catch { return false; }
  }
  // Legacy plaintext vergelijking (timing-safe)
  return safeCompare(input, stored);
}
function safeCompare(a, b) {
  const ba = Buffer.alloc(256, 0); Buffer.from(String(a||'')).copy(ba);
  const bb = Buffer.alloc(256, 0); Buffer.from(String(b||'')).copy(bb);
  return crypto.timingSafeEqual(ba, bb);
}

// ─── WACHTWOORD MIGRATIE ──────────────────────────────────
// Bij opstart: hash alle nog plaintext wachtwoorden in accounts.json
function migratePasswords() {
  try {
    const data = readJSON(ACCOUNTS_FILE);
    let changed = false;
    (data.accounts || []).forEach(acc => {
      if (acc.password && !acc.password.startsWith('pbkdf2:')) {
        acc.password = hashPassword(acc.password);
        changed = true;
      }
    });
    if (changed) writeJSON(ACCOUNTS_FILE, data);
  } catch { /* stil falen */ }
}

// ─── RATE LIMITING (in-memory) ────────────────────────────
const rlMap = new Map();
function checkRateLimit(key, maxAttempts, windowMs) {
  const now = Date.now();
  const r   = rlMap.get(key) || { n: 0, reset: now + windowMs };
  if (now > r.reset) { r.n = 0; r.reset = now + windowMs; }
  r.n++;
  rlMap.set(key, r);
  return r.n <= maxAttempts; // true = toegestaan, false = geblokkeerd
}
// Ruim verlopen entries op elke 10 minuten
setInterval(() => { const now = Date.now(); rlMap.forEach((v,k) => { if (now > v.reset + 60000) rlMap.delete(k); }); }, 600000);

// ─── HELPERS ──────────────────────────────────────────────
function readJSON(file)       { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } }
function writeJSON(file, data){ fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function generateId()         { return crypto.randomBytes(8).toString('hex'); }
function getClientIp(req)     { return (req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.socket.remoteAddress || 'unknown'; }

// Invoer opschonen — trim + max lengte + strip null bytes
function sanitize(val, maxLen = 1000) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\0/g, '').trim().slice(0, maxLen);
}

// ─── MULTI-ADMIN AUTH ─────────────────────────────────────
// Zoek admin op basis van username + wachtwoord uit request headers/body.
// Geeft admin-object terug of null.
function getAdminFromRequest(req) {
  const username = sanitize(req.body?.adminUsername || req.headers['x-admin-username'], 100);
  const provided = sanitize(req.body?.adminPassword || req.headers['x-admin-password'] || req.query?.adminPassword, 200);
  if (!provided) return null;
  const d = readJSON(ADMINS_FILE);
  const admins = d.admins || [];
  let admin;
  if (username) {
    admin = admins.find(a => a.username === username);
  } else if (admins.length === 1) {
    admin = admins[0]; // backward compat: één admin, geen username nodig
  } else {
    return null;
  }
  if (!admin) return null;
  if (!verifyPassword(provided, admin.password) && !safeCompare(provided, admin.password)) return null;
  return admin;
}

// Volledig geauthenticeerd — voor gewone API-aanroepen alleen wachtwoord nodig.
// 2FA wordt alleen gecontroleerd bij het inloggen (login-check endpoint).
// Dit is standaard sessie-gedrag: je bewijst 2FA eenmalig bij inloggen.
function getAuthenticatedAdmin(req) {
  return getAdminFromRequest(req); // wachtwoord is voldoende na inloggen
}

function adminAuth(req)             { return !!getAdminFromRequest(req); }
function adminAuthPasswordOnly(req) { return !!getAdminFromRequest(req); }

// Auth helpers
function teacherAuth(password) { return safeCompare(password, TEACHER_PASS); }

// Multi-teacher auth: geeft teacher-object terug of null
function getTeacher(req) {
  const username = sanitize(req.headers['x-teacher-username'] || req.body?.teacherUsername, 200);
  const password = sanitize(req.headers['x-teacher-password'] || req.body?.teacherPassword, 200);
  if (!password) return null;
  const data = readJSON(TEACHERS_FILE);
  const teachers = data.teachers || [];
  if (teachers.length > 0) {
    if (!username) return null;
    const t = teachers.find(t2 => t2.username === username && t2.active !== false);
    if (t && verifyPassword(password, t.password)) return t;
    return null;
  }
  // Legacy fallback (geen docenten aangemaakt)
  if (safeCompare(password, TEACHER_PASS)) {
    return { id: 'legacy', name: 'Docent', username: 'docent', permissions: ALL_PERMISSIONS };
  }
  return null;
}
function hasPermission(teacher, perm) {
  if (!teacher) return false;
  return Array.isArray(teacher.permissions) && teacher.permissions.includes(perm);
}

// ─── MULTER FILE UPLOAD ───────────────────────────────────
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/mp4',
  'text/plain',
  'application/zip',
]);
const ALLOWED_EXTS = new Set([
  '.pdf','.doc','.docx','.ppt','.pptx','.xls','.xlsx',
  '.jpg','.jpeg','.png','.gif','.webp',
  '.mp4','.webm','.mp3','.m4a',
  '.txt','.zip',
]);
const IMAGE_MIMES = new Set(['image/jpeg','image/png','image/gif','image/webp']);
const IMAGE_EXTS  = new Set(['.jpg','.jpeg','.png','.gif','.webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => cb(null, generateId() + path.extname(file.originalname).toLowerCase()),
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIMES.has(file.mimetype) && ALLOWED_EXTS.has(ext)) cb(null, true);
    else cb(new Error('Bestandstype niet toegestaan'));
  },
});
const galleryUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (IMAGE_MIMES.has(file.mimetype) && IMAGE_EXTS.has(ext)) cb(null, true);
    else cb(new Error('Alleen afbeeldingen (jpg, png, gif, webp) zijn toegestaan'));
  },
});

// ══════════════════════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════════════════════

// 1. Beveiligingsheaders (zonder externe packages)
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options',   'nosniff');
  res.setHeader('X-Frame-Options',           'SAMEORIGIN');
  res.setHeader('X-XSS-Protection',          '1; mode=block');
  res.setHeader('Referrer-Policy',           'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy',        'geolocation=(), camera=(), microphone=()');
  res.setHeader('Cross-Origin-Opener-Policy','same-origin');
  next();
});

// 2. Blokkeer toegang tot gevoelige server-bestanden
const BLOCKED_PATHS = [
  /^\/server\.js$/i,
  /^\/package(-lock)?\.json$/i,
  /^\/node_modules\//i,
  /^\/data\//i,
  /^\/.env/i,
  /^\/.git/i,
  /^\/admin\.json$/i,
  /^\/accounts\.json$/i,
  /^\/beheerder\.html$/i,   // admin panel alleen via geheime URL bereikbaar
];
app.use((req, res, next) => {
  if (BLOCKED_PATHS.some(re => re.test(req.path))) return res.status(403).end();
  next();
});

// 3. Body parser met grootte limiet
app.use(express.json({ limit: '1mb' }));

// 4. Geheime beheerder URL (vóór static middleware)
app.get('/beheer-nonf-2026', (req, res) => {
  res.sendFile(path.join(__dirname, 'beheerder.html'));
});

// 5. Statische bestanden
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(UPLOADS_DIR));

// ══════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════

// ─── AUTH ─────────────────────────────────────────────────
app.post('/api/verify-password', (req, res) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(`teacher:${ip}`, 10, 60000)) {
    return res.status(429).json({ ok: false, error: 'Te veel pogingen. Wacht 1 minuut.' });
  }
  const teacher = getTeacher(req);
  if (teacher) {
    res.json({ ok: true, id: teacher.id, name: teacher.name, username: teacher.username, permissions: teacher.permissions });
  } else {
    res.status(401).json({ ok: false });
  }
});

// ─── Q&A ──────────────────────────────────────────────────
app.get('/api/questions', (req, res) => {
  const data      = readJSON(QUESTIONS_FILE);
  const email     = sanitize(req.query.email, 200);
  const questions = email
    ? (data.questions || []).filter(q => q.askedBy === email)
    : (data.questions || []);
  res.json(questions.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

app.post('/api/questions', (req, res) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(`questions:${ip}`, 20, 60000)) return res.status(429).json({ error: 'Te snel. Even wachten.' });
  const lessonId    = sanitize(req.body.lessonId, 100);
  const lessonTitle = sanitize(req.body.lessonTitle, 200);
  const question    = sanitize(req.body.question, 2000);
  const askedBy     = sanitize(req.body.askedBy, 200);
  const childName   = sanitize(req.body.childName, 100);
  if (!lessonId || !question || !askedBy) return res.status(400).json({ error: 'Vereiste velden ontbreken' });
  const data = readJSON(QUESTIONS_FILE);
  if (!data.questions) data.questions = [];
  const q = { id: generateId(), lessonId, lessonTitle: lessonTitle||lessonId, question, askedBy, childName: childName||'Onbekend', timestamp: new Date().toISOString(), answer: null, answeredAt: null };
  data.questions.push(q);
  writeJSON(QUESTIONS_FILE, data);
  res.status(201).json(q);
});

app.post('/api/questions/:id/answer', (req, res) => {
  const teacher = getTeacher(req);
  if (!teacher || !hasPermission(teacher, 'vragen')) return res.status(401).json({ error: 'Geen toegang' });
  const { answer } = req.body;
  if (!sanitize(answer, 5000)) return res.status(400).json({ error: 'Antwoord mag niet leeg zijn' });
  const data = readJSON(QUESTIONS_FILE);
  const q = (data.questions||[]).find(q => q.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Niet gevonden' });
  q.answer = sanitize(answer, 5000);
  q.answeredAt = new Date().toISOString();
  writeJSON(QUESTIONS_FILE, data);
  res.json(q);
});

app.delete('/api/questions/:id', (req, res) => {
  const teacher = getTeacher(req);
  if (!teacher || !hasPermission(teacher, 'vragen')) return res.status(401).json({ error: 'Geen toegang' });
  const data = readJSON(QUESTIONS_FILE);
  data.questions = (data.questions||[]).filter(q => q.id !== req.params.id);
  writeJSON(QUESTIONS_FILE, data);
  res.json({ success: true });
});

// ─── FILES ────────────────────────────────────────────────
app.get('/api/files', (req, res) => {
  const data  = readJSON(FILES_META);
  let files   = (data.files||[]).sort((a,b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  const vak   = sanitize(req.query.vak, 100);
  if (vak) files = files.filter(f => f.vak === vak);
  res.json(files);
});

app.post('/api/files', (req, res) => {
  const teacher = getTeacher(req);
  if (!teacher || !hasPermission(teacher, 'materiaal')) return res.status(401).json({ error: 'Geen toegang' });
  upload.single('file')(req, res, err => {
    if (err) return res.status(400).json({ error: 'Upload mislukt' });
    if (!req.file) return res.status(400).json({ error: 'Geen bestand ontvangen' });
    const title       = sanitize(req.body.title, 200);
    const description = sanitize(req.body.description, 500);
    const vak         = sanitize(req.body.vak, 100);
    const data        = readJSON(FILES_META);
    if (!data.files) data.files = [];
    const meta = { id: generateId(), title: title||req.file.originalname, description, vak: vak||'Algemeen', originalName: req.file.originalname, storedName: req.file.filename, mimetype: req.file.mimetype, size: req.file.size, url: '/uploads/'+req.file.filename, uploadedAt: new Date().toISOString() };
    data.files.push(meta);
    writeJSON(FILES_META, data);
    res.status(201).json(meta);
  });
});

app.delete('/api/files/:id', (req, res) => {
  const teacher = getTeacher(req);
  if (!teacher || !hasPermission(teacher, 'materiaal')) return res.status(401).json({ error: 'Geen toegang' });
  const data = readJSON(FILES_META);
  const file = (data.files||[]).find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'Niet gevonden' });
  const fp = path.join(UPLOADS_DIR, file.storedName);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  data.files = data.files.filter(f => f.id !== req.params.id);
  writeJSON(FILES_META, data);
  res.json({ success: true });
});

// ─── REVIEWS ──────────────────────────────────────────────
app.get('/api/reviews', (req, res) => {
  const data = readJSON(REVIEWS_FILE);
  res.json((data.reviews||[]).sort((a,b) => new Date(b.submittedAt)-new Date(a.submittedAt)));
});

app.post('/api/reviews', (req, res) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(`review:${ip}`, 3, 3600000)) return res.status(429).json({ error: 'Te veel reviews. Wacht een uur.' });
  const name   = sanitize(req.body.name, 100);
  const role   = sanitize(req.body.role, 100);
  const rating = Math.min(5, Math.max(1, parseInt(req.body.rating)||5));
  const text   = sanitize(req.body.text, 1000);
  if (!name || !text) return res.status(400).json({ error: 'Naam en tekst zijn verplicht' });
  const data = readJSON(REVIEWS_FILE);
  if (!data.reviews) data.reviews = [];
  const review = { id: generateId(), name, role, rating, text, submittedAt: new Date().toISOString() };
  data.reviews.push(review);
  writeJSON(REVIEWS_FILE, data);
  res.status(201).json(review);
});

app.delete('/api/reviews/:id', (req, res) => {
  if (!adminAuth(req) && !teacherAuth(sanitize(req.body.teacherPassword, 200))) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(REVIEWS_FILE);
  data.reviews = (data.reviews||[]).filter(r => r.id !== req.params.id);
  writeJSON(REVIEWS_FILE, data);
  res.json({ success: true });
});

// ─── REGISTRATIONS ────────────────────────────────────────
app.get('/api/registrations', (req, res) => {
  const teacher = getTeacher(req);
  if (!adminAuth(req) && (!teacher || !hasPermission(teacher, 'inschrijvingen'))) return res.status(401).json({ error: 'Geen toegang' });
  const data = readJSON(REGISTRATIONS_FILE);
  res.json((data.registrations||[]).sort((a,b) => new Date(b.submittedAt)-new Date(a.submittedAt)));
});

app.post('/api/registrations', (req, res) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(`reg:${ip}`, 5, 3600000)) return res.status(429).json({ error: 'Te veel aanmeldingen. Probeer later.' });
  const voornaam   = sanitize(req.body.voornaam, 100);
  const achternaam = sanitize(req.body.achternaam, 100);
  const email      = sanitize(req.body.email, 200);
  const telefoon   = sanitize(req.body.telefoon, 50);
  const kindNaam   = sanitize(req.body.kindNaam, 100);
  const leeftijd   = sanitize(req.body.leeftijd || req.body.leerjaar, 20);
  const vak        = sanitize(req.body.vak, 100);
  const bericht    = sanitize(req.body.bericht, 2000);
  if (!voornaam || !email || !kindNaam) return res.status(400).json({ error: 'Vereiste velden ontbreken' });
  // Basis e-mail validatie
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Ongeldig e-mailadres' });
  const data = readJSON(REGISTRATIONS_FILE);
  if (!data.registrations) data.registrations = [];
  const reg = { id: generateId(), voornaam, achternaam, email, telefoon, kindNaam, leeftijd, vak, bericht, status: 'nieuw', submittedAt: new Date().toISOString() };
  data.registrations.push(reg);
  writeJSON(REGISTRATIONS_FILE, data);
  res.status(201).json(reg);
});

app.patch('/api/registrations/:id', (req, res) => {
  const teacher = getTeacher(req);
  if (!adminAuth(req) && (!teacher || !hasPermission(teacher, 'inschrijvingen'))) return res.status(401).json({ error: 'Geen toegang' });
  const allowed = ['nieuw','contact opgenomen','ingeschreven','afgewezen'];
  const status  = sanitize(req.body.status, 50);
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Ongeldige status' });
  const data = readJSON(REGISTRATIONS_FILE);
  const reg  = (data.registrations||[]).find(r => r.id === req.params.id);
  if (!reg) return res.status(404).json({ error: 'Niet gevonden' });
  reg.status = status;
  writeJSON(REGISTRATIONS_FILE, data);
  res.json(reg);
});

app.delete('/api/registrations/:id', (req, res) => {
  const teacher = getTeacher(req);
  if (!adminAuth(req) && (!teacher || !hasPermission(teacher, 'inschrijvingen'))) return res.status(401).json({ error: 'Geen toegang' });
  const data = readJSON(REGISTRATIONS_FILE);
  data.registrations = (data.registrations||[]).filter(r => r.id !== req.params.id);
  writeJSON(REGISTRATIONS_FILE, data);
  res.json({ success: true });
});

// ─── PARENT AUTH ──────────────────────────────────────────
app.post('/api/verify-parent', (req, res) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(`parent:${ip}`, 10, 900000)) { // 10 pogingen per 15 minuten
    return res.status(429).json({ ok: false, error: 'Te veel inlogpogingen. Wacht 15 minuten.' });
  }
  const email    = sanitize(req.body.email, 200);
  const password = sanitize(req.body.password, 200);
  if (!email || !password) return res.status(400).json({ ok: false });
  const data    = readJSON(ACCOUNTS_FILE);
  const account = (data.accounts||[]).find(a => a.email === email);
  if (account && verifyPassword(password, account.password)) {
    res.json({ ok: true, kindNaam: account.kindNaam, name: account.name, mustChangePassword: !!account.mustChangePassword });
  } else {
    // Zelfde vertraging ook bij verkeerd account — timing-aanval voorkomen
    crypto.pbkdf2Sync('dummy', 'dummy', 1000, 32, 'sha256');
    res.status(401).json({ ok: false });
  }
});

app.post('/api/parent/change-password', (req, res) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(`chpass:${ip}`, 5, 300000)) return res.status(429).json({ error: 'Te veel pogingen.' });
  const email           = sanitize(req.body.email, 200);
  const currentPassword = sanitize(req.body.currentPassword, 200);
  const newPassword     = sanitize(req.body.newPassword, 200);
  if (!email || !currentPassword || !newPassword) return res.status(400).json({ error: 'Vereiste velden ontbreken' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Wachtwoord moet minimaal 6 tekens zijn' });
  const data    = readJSON(ACCOUNTS_FILE);
  const account = (data.accounts||[]).find(a => a.email === email);
  if (!account || !verifyPassword(currentPassword, account.password)) return res.status(401).json({ error: 'Huidig wachtwoord klopt niet' });
  account.password          = hashPassword(newPassword);
  account.mustChangePassword = false;
  writeJSON(ACCOUNTS_FILE, data);
  res.json({ ok: true });
});

// ─── PUBLIC SETTINGS ──────────────────────────────────────
app.get('/api/settings', (req, res) => res.json(readJSON(SETTINGS_FILE)));

// ─── ADMIN API ────────────────────────────────────────────
function requireAdmin(req, res) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`admin:${ip}`, 20, 60000)) {
    res.status(429).json({ error: 'Te veel verzoeken.' }); return null;
  }
  const admin = getAuthenticatedAdmin(req);
  if (!admin) { res.status(401).json({ error: 'Ongeldig wachtwoord of code' }); return null; }
  return admin; // truthy — bestaande `if (!requireAdmin(...)) return;` werkt nog steeds
}

app.get('/api/admin/stats', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const registrations = readJSON(REGISTRATIONS_FILE).registrations || [];
  const questions     = readJSON(QUESTIONS_FILE).questions         || [];
  const reviews       = readJSON(REVIEWS_FILE).reviews             || [];
  const files         = readJSON(FILES_META).files                 || [];
  const accounts      = readJSON(ACCOUNTS_FILE).accounts           || [];
  res.json({
    totalRegistrations: registrations.length,
    newRegistrations:   registrations.filter(r => r.status === 'nieuw').length,
    openQuestions:      questions.filter(q => !q.answer).length,
    totalQuestions:     questions.length,
    totalReviews:       reviews.length,
    avgRating:          reviews.length ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1) : '—',
    totalFiles:         files.length,
    totalAccounts:      accounts.length,
    recentRegistrations: registrations.slice(-5).reverse(),
  });
});

app.get('/api/admin/settings', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(readJSON(SETTINGS_FILE));
});
app.put('/api/admin/settings', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const allowed = ['siteName','slogan','email','telefoon','whatsapp','adres','openingstijden','instagram','facebook','tiktok'];
  const current = readJSON(SETTINGS_FILE);
  allowed.forEach(k => { if (req.body[k] !== undefined) current[k] = sanitize(req.body[k], 500); });
  writeJSON(SETTINGS_FILE, current);
  res.json(current);
});

app.get('/api/admin/accounts', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const data = readJSON(ACCOUNTS_FILE);
  const safe = (data.accounts||[]).map(({ password: _, ...a }) => a);
  res.json(safe);
});
app.post('/api/admin/accounts', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const email    = sanitize(req.body.email, 200);
  const password = sanitize(req.body.password, 200);
  const kindNaam = sanitize(req.body.kindNaam, 100);
  const name     = sanitize(req.body.name, 100);
  if (!email || !password || !kindNaam) return res.status(400).json({ error: 'E-mail, wachtwoord en naam kind zijn verplicht' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Ongeldig e-mailadres' });
  if (password.length < 4) return res.status(400).json({ error: 'Wachtwoord te kort (min. 4 tekens)' });
  const data = readJSON(ACCOUNTS_FILE);
  if (!data.accounts) data.accounts = [];
  if (data.accounts.find(a => a.email === email)) return res.status(409).json({ error: 'E-mailadres al in gebruik' });
  const account = { id: generateId(), email, password: hashPassword(password), kindNaam, name, mustChangePassword: true, createdAt: new Date().toISOString() };
  data.accounts.push(account);
  writeJSON(ACCOUNTS_FILE, data);
  const { password: _, ...safe } = account;
  res.status(201).json(safe);
});
app.delete('/api/admin/accounts/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const data = readJSON(ACCOUNTS_FILE);
  data.accounts = (data.accounts||[]).filter(a => a.id !== req.params.id);
  writeJSON(ACCOUNTS_FILE, data);
  res.json({ success: true });
});

app.post('/api/admin/change-password', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const newPassword = sanitize(req.body.newPassword, 200);
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Minimaal 6 tekens vereist' });
  const d = readJSON(ADMINS_FILE);
  const target = (d.admins || []).find(a => a.id === admin.id);
  if (!target) return res.status(404).json({ error: 'Beheerder niet gevonden' });
  target.password = hashPassword(newPassword);
  writeJSON(ADMINS_FILE, d);
  res.json({ success: true });
});

// CSV exports — wachtwoord in body (niet in URL)
app.post('/api/admin/export-csv', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows   = readJSON(REGISTRATIONS_FILE).registrations || [];
  const header = ['ID','Voornaam','Achternaam','Email','Telefoon','Kind naam','Leeftijd','Vak','Status','Bericht','Datum'];
  const csv    = [header, ...rows.map(r => [
    r.id, r.voornaam, r.achternaam, r.email, r.telefoon,
    r.kindNaam, r.leeftijd, r.vak, r.status,
    (r.bericht||'').replace(/[\n\r]/g,' '),
    new Date(r.submittedAt).toLocaleString('nl-NL')
  ])].map(row => row.map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="inschrijvingen.csv"');
  res.send('﻿' + csv);
});

app.post('/api/admin/export-reviews-csv', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows   = readJSON(REVIEWS_FILE).reviews || [];
  const header = ['ID','Naam','Rol','Sterren','Tekst','Datum'];
  const csv    = [header, ...rows.map(r => [
    r.id, r.name, r.role||'', r.rating, r.text,
    new Date(r.submittedAt).toLocaleString('nl-NL')
  ])].map(row => row.map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="reviews.csv"');
  res.send('﻿' + csv);
});

// ─── GALLERY ──────────────────────────────────────────────
app.get('/api/gallery', (req, res) => {
  const data = readJSON(GALLERY_FILE);
  res.json((data.items||[]).sort((a,b) => new Date(b.uploadedAt)-new Date(a.uploadedAt)));
});
app.post('/api/gallery', (req, res) => {
  const teacher = getTeacher(req);
  if (!adminAuth(req) && (!teacher || !hasPermission(teacher, 'galerij')))
    return res.status(401).json({ error: 'Geen toegang' });
  galleryUpload.single('image')(req, res, err => {
    if (err) return res.status(400).json({ error: 'Upload mislukt' });
    if (!req.file) return res.status(400).json({ error: 'Geen afbeelding ontvangen' });
    const title       = sanitize(req.body.title, 200);
    const description = sanitize(req.body.description, 500);
    const data        = readJSON(GALLERY_FILE);
    if (!data.items) data.items = [];
    const item = { id: generateId(), title: title||req.file.originalname, description, storedName: req.file.filename, url: '/uploads/'+req.file.filename, uploadedAt: new Date().toISOString() };
    data.items.push(item);
    writeJSON(GALLERY_FILE, data);
    res.status(201).json(item);
  });
});
app.patch('/api/gallery/:id', (req, res) => {
  const teacher = getTeacher(req);
  if (!adminAuth(req) && (!teacher || !hasPermission(teacher, 'galerij')))
    return res.status(401).json({ error: 'Geen toegang' });
  const data = readJSON(GALLERY_FILE);
  const item = (data.items||[]).find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Niet gevonden' });
  if (req.body.title !== undefined)       item.title       = sanitize(req.body.title, 200);
  if (req.body.description !== undefined) item.description = sanitize(req.body.description, 500);
  writeJSON(GALLERY_FILE, data);
  res.json(item);
});
app.delete('/api/gallery/:id', (req, res) => {
  const teacher = getTeacher(req);
  if (!adminAuth(req) && (!teacher || !hasPermission(teacher, 'galerij')))
    return res.status(401).json({ error: 'Geen toegang' });
  const data = readJSON(GALLERY_FILE);
  const item = (data.items||[]).find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Niet gevonden' });
  const fp = path.join(UPLOADS_DIR, item.storedName);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  data.items = data.items.filter(i => i.id !== req.params.id);
  writeJSON(GALLERY_FILE, data);
  res.json({ success: true });
});

// ─── PRODUCTS ─────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const data = readJSON(PRODUCTS_FILE);
  let list   = (data.products||[]).sort((a,b) => (a.volgorde||0)-(b.volgorde||0) || new Date(a.createdAt)-new Date(b.createdAt));
  if (!(req.query.all === '1' && adminAuth(req))) list = list.filter(p => p.actief !== false);
  res.json(list);
});
app.post('/api/products', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const naam        = sanitize(req.body.naam, 200);
  const beschrijving= sanitize(req.body.beschrijving, 1000);
  const prijs       = parseFloat(req.body.prijs) || 0;
  const badge       = sanitize(req.body.badge, 50);
  const badgeKleur  = sanitize(req.body.badgeKleur, 20);
  const categorie   = sanitize(req.body.categorie, 100);
  const icon        = sanitize(req.body.icon, 50);
  const afbeelding  = sanitize(req.body.afbeelding, 300);
  const volgorde    = parseInt(req.body.volgorde) || 0;
  const actief      = req.body.actief !== false;
  if (!naam) return res.status(400).json({ error: 'Naam is verplicht' });
  const data    = readJSON(PRODUCTS_FILE);
  if (!data.products) data.products = [];
  const product = { id: generateId(), naam, beschrijving, prijs, badge, badgeKleur, categorie: categorie||'Overig', icon: icon||'fa-tag', afbeelding: afbeelding||null, actief, volgorde, createdAt: new Date().toISOString() };
  data.products.push(product);
  writeJSON(PRODUCTS_FILE, data);
  res.status(201).json(product);
});
app.put('/api/products/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const data = readJSON(PRODUCTS_FILE);
  const p    = (data.products||[]).find(p => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Niet gevonden' });
  if (req.body.naam        !== undefined) p.naam        = sanitize(req.body.naam, 200);
  if (req.body.beschrijving!== undefined) p.beschrijving= sanitize(req.body.beschrijving, 1000);
  if (req.body.prijs       !== undefined) p.prijs       = parseFloat(req.body.prijs)||0;
  if (req.body.badge       !== undefined) p.badge       = sanitize(req.body.badge, 50);
  if (req.body.badgeKleur  !== undefined) p.badgeKleur  = sanitize(req.body.badgeKleur, 20);
  if (req.body.categorie   !== undefined) p.categorie   = sanitize(req.body.categorie, 100);
  if (req.body.icon        !== undefined) p.icon        = sanitize(req.body.icon, 50);
  if (req.body.afbeelding  !== undefined) p.afbeelding  = sanitize(req.body.afbeelding, 300)||null;
  if (req.body.actief      !== undefined) p.actief      = !!req.body.actief;
  if (req.body.volgorde    !== undefined) p.volgorde    = parseInt(req.body.volgorde)||0;
  writeJSON(PRODUCTS_FILE, data);
  res.json(p);
});
app.delete('/api/products/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const data = readJSON(PRODUCTS_FILE);
  data.products = (data.products||[]).filter(p => p.id !== req.params.id);
  writeJSON(PRODUCTS_FILE, data);
  res.json({ success: true });
});

// ─── AGENDA ACCOUNTS (docent mag lijst zien voor picker) ──
app.get('/api/agenda/accounts', (req, res) => {
  const teacher = getTeacher(req);
  if (!teacher && !adminAuth(req)) return res.status(401).json({ error: 'Geen toegang' });
  const data = readJSON(ACCOUNTS_FILE);
  const safe = (data.accounts || []).map(({ password: _, mustChangePassword: __, ...a }) => a);
  res.json(safe);
});

// ─── AGENDA ───────────────────────────────────────────────
// GET — ouders zien alleen hun items; docent/admin ziet alles
app.get('/api/agenda', (req, res) => {
  const data  = readJSON(AGENDA_FILE);
  let items   = (data.items || []).sort((a, b) => {
    const da = new Date(`${a.datum}T${a.tijd||'00:00'}`);
    const db = new Date(`${b.datum}T${b.tijd||'00:00'}`);
    return da - db;
  });
  const email    = sanitize(req.query.email, 200);
  const isTeacher = !!getTeacher(req);
  const isAdmin   = adminAuth(req);
  // Docent/admin: alles zien
  if (isTeacher || isAdmin) return res.json(items);
  // Ouder: alleen "iedereen" items OF items waarbij email in gebruikers staat
  if (email) {
    items = items.filter(item =>
      item.zichtbaar === 'iedereen' ||
      (item.zichtbaar === 'specifiek' && Array.isArray(item.gebruikers) && item.gebruikers.includes(email))
    );
    return res.json(items);
  }
  // Niet ingelogd: alleen "iedereen" items
  items = items.filter(i => i.zichtbaar === 'iedereen');
  res.json(items);
});

// POST — nieuw agenda-item aanmaken (docent)
app.post('/api/agenda', (req, res) => {
  const teacher = getTeacher(req);
  if ((!teacher || !hasPermission(teacher, 'agenda')) && !adminAuth(req))
    return res.status(401).json({ error: 'Geen toegang' });
  const titel       = sanitize(req.body.titel, 200);
  const beschrijving= sanitize(req.body.beschrijving, 1000);
  const datum       = sanitize(req.body.datum, 20);
  const tijd        = sanitize(req.body.tijd, 10);
  const eindtijd    = sanitize(req.body.eindtijd, 10);
  const type        = sanitize(req.body.type, 30) || 'les';
  const zichtbaar   = req.body.zichtbaar === 'specifiek' ? 'specifiek' : 'iedereen';
  const gebruikers  = Array.isArray(req.body.gebruikers) ? req.body.gebruikers.map(e => sanitize(e, 200)) : [];
  const kleur       = sanitize(req.body.kleur, 20) || 'primary';
  if (!titel || !datum) return res.status(400).json({ error: 'Titel en datum zijn verplicht' });
  const data = readJSON(AGENDA_FILE);
  if (!data.items) data.items = [];
  const item = { id: generateId(), titel, beschrijving, datum, tijd, eindtijd, type, zichtbaar, gebruikers, kleur, createdAt: new Date().toISOString() };
  data.items.push(item);
  writeJSON(AGENDA_FILE, data);
  res.status(201).json(item);
});

// PUT — agenda-item bewerken (docent)
app.put('/api/agenda/:id', (req, res) => {
  const teacher = getTeacher(req);
  if ((!teacher || !hasPermission(teacher, 'agenda')) && !adminAuth(req))
    return res.status(401).json({ error: 'Geen toegang' });
  const data = readJSON(AGENDA_FILE);
  const item = (data.items || []).find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Niet gevonden' });
  if (req.body.titel        !== undefined) item.titel        = sanitize(req.body.titel, 200);
  if (req.body.beschrijving !== undefined) item.beschrijving = sanitize(req.body.beschrijving, 1000);
  if (req.body.datum        !== undefined) item.datum        = sanitize(req.body.datum, 20);
  if (req.body.tijd         !== undefined) item.tijd         = sanitize(req.body.tijd, 10);
  if (req.body.eindtijd     !== undefined) item.eindtijd     = sanitize(req.body.eindtijd, 10);
  if (req.body.type         !== undefined) item.type         = sanitize(req.body.type, 30);
  if (req.body.zichtbaar    !== undefined) item.zichtbaar    = req.body.zichtbaar === 'specifiek' ? 'specifiek' : 'iedereen';
  if (req.body.gebruikers   !== undefined) item.gebruikers   = Array.isArray(req.body.gebruikers) ? req.body.gebruikers.map(e => sanitize(e, 200)) : [];
  if (req.body.kleur        !== undefined) item.kleur        = sanitize(req.body.kleur, 20);
  writeJSON(AGENDA_FILE, data);
  res.json(item);
});

// DELETE — agenda-item verwijderen (docent)
app.delete('/api/agenda/:id', (req, res) => {
  const teacher = getTeacher(req);
  if ((!teacher || !hasPermission(teacher, 'agenda')) && !adminAuth(req))
    return res.status(401).json({ error: 'Geen toegang' });
  const data = readJSON(AGENDA_FILE);
  data.items = (data.items || []).filter(i => i.id !== req.params.id);
  writeJSON(AGENDA_FILE, data);
  res.json({ success: true });
});

// ─── DOCENTEN BEHEER (admin) ──────────────────────────────
app.get('/api/admin/teachers', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const data = readJSON(TEACHERS_FILE);
  const safe = (data.teachers || []).map(({ password: _, ...t }) => t);
  res.json({ teachers: safe });
});

app.post('/api/admin/teachers', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const name        = sanitize(req.body.name, 100);
  const username    = sanitize(req.body.username, 100);
  const password    = sanitize(req.body.password, 200);
  const permissions = Array.isArray(req.body.permissions)
    ? req.body.permissions.filter(p => ALL_PERMISSIONS.includes(p))
    : ['vragen','agenda','materiaal','inschrijvingen'];
  if (!name || !username || !password) return res.status(400).json({ error: 'Naam, gebruikersnaam en wachtwoord zijn verplicht' });
  const data = readJSON(TEACHERS_FILE);
  if (!data.teachers) data.teachers = [];
  if (data.teachers.find(t => t.username === username))
    return res.status(409).json({ error: 'Gebruikersnaam al in gebruik' });
  const teacher = { id: generateId(), name, username, password: hashPassword(password), permissions, active: true, createdAt: new Date().toISOString() };
  data.teachers.push(teacher);
  writeJSON(TEACHERS_FILE, data);
  const { password: _, ...safe } = teacher;
  res.status(201).json(safe);
});

app.put('/api/admin/teachers/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const data    = readJSON(TEACHERS_FILE);
  const teacher = (data.teachers || []).find(t => t.id === req.params.id);
  if (!teacher) return res.status(404).json({ error: 'Niet gevonden' });
  if (req.body.name     !== undefined) teacher.name     = sanitize(req.body.name, 100);
  if (req.body.username !== undefined) {
    const u = sanitize(req.body.username, 100);
    if (data.teachers.find(t => t.username === u && t.id !== req.params.id))
      return res.status(409).json({ error: 'Gebruikersnaam al in gebruik' });
    teacher.username = u;
  }
  if (req.body.password) teacher.password = hashPassword(sanitize(req.body.password, 200));
  if (Array.isArray(req.body.permissions))
    teacher.permissions = req.body.permissions.filter(p => ALL_PERMISSIONS.includes(p));
  if (req.body.active !== undefined) teacher.active = !!req.body.active;
  writeJSON(TEACHERS_FILE, data);
  const { password: _, ...safe } = teacher;
  res.json(safe);
});

app.delete('/api/admin/teachers/:id', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const data = readJSON(TEACHERS_FILE);
  data.teachers = (data.teachers || []).filter(t => t.id !== req.params.id);
  writeJSON(TEACHERS_FILE, data);
  res.json({ success: true });
});

// ─── 2FA (per beheerder) ──────────────────────────────────

// Status van 2FA voor huidige beheerder
app.get('/api/admin/2fa/status', (req, res) => {
  const admin = getAdminFromRequest(req);
  if (!admin) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  res.json({ enabled: !!(admin.twoFactorEnabled && admin.twoFactorSecret) });
});

// Genereer nieuw TOTP-secret + QR code voor huidige beheerder
app.post('/api/admin/2fa/setup', async (req, res) => {
  const admin = getAdminFromRequest(req);
  if (!admin) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const secret = speakeasy.generateSecret({ name: `NONF Beheer (${admin.username})`, length: 20 });
  try {
    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ secret: secret.base32, qr: qrDataUrl });
  } catch (e) {
    res.status(500).json({ error: 'QR generatie mislukt' });
  }
});

// Activeer 2FA voor huidige beheerder
app.post('/api/admin/2fa/enable', (req, res) => {
  const admin = getAdminFromRequest(req);
  if (!admin) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const { secret, token } = req.body;
  if (!secret || !token) return res.status(400).json({ error: 'Secret en token verplicht' });
  const ok = speakeasy.totp.verify({ secret, encoding: 'base32', token: String(token), window: 1 });
  if (!ok) return res.status(400).json({ error: 'Ongeldige code. Probeer opnieuw.' });
  const d = readJSON(ADMINS_FILE);
  const target = (d.admins || []).find(a => a.id === admin.id);
  if (!target) return res.status(404).json({ error: 'Beheerder niet gevonden' });
  target.twoFactorSecret  = secret;
  target.twoFactorEnabled = true;
  writeJSON(ADMINS_FILE, d);
  res.json({ ok: true });
});

// Schakel 2FA uit voor huidige beheerder (vereist wachtwoord + geldige TOTP als extra check)
app.post('/api/admin/2fa/disable', (req, res) => {
  const admin = getAdminFromRequest(req);
  if (!admin) return res.status(401).json({ error: 'Ongeldig wachtwoord of code' });
  // Expliciete TOTP-controle bij uitschakelen (veiligheidscheck)
  if (admin.twoFactorEnabled && admin.twoFactorSecret) {
    const token = sanitize(req.body?.adminTotp || req.headers['x-admin-totp'], 10);
    if (!token) return res.status(400).json({ error: 'Voer je authenticator code in' });
    const ok = speakeasy.totp.verify({ secret: admin.twoFactorSecret, encoding: 'base32', token, window: 1 });
    if (!ok) return res.status(401).json({ error: 'Ongeldige authenticator code' });
  }
  const d = readJSON(ADMINS_FILE);
  const target = (d.admins || []).find(a => a.id === admin.id);
  if (!target) return res.status(404).json({ error: 'Beheerder niet gevonden' });
  target.twoFactorEnabled = false;
  target.twoFactorSecret  = null;
  writeJSON(ADMINS_FILE, d);
  res.json({ ok: true });
});

// Login check — geeft terug of 2FA vereist is (stap 1 van login)
app.post('/api/admin/login-check', (req, res) => {
  const ip = getClientIp(req);
  if (!checkRateLimit(`logincheck:${ip}`, 15, 60000)) return res.status(429).json({ ok: false, error: 'Te veel pogingen.' });
  const admin = getAdminFromRequest(req);
  if (!admin) {
    crypto.pbkdf2Sync('dummy', 'dummy', 1000, 32, 'sha256'); // timing-safe
    return res.status(401).json({ ok: false });
  }
  res.json({ ok: true, requires2fa: !!(admin.twoFactorEnabled && admin.twoFactorSecret) });
});

// ─── BEHEERDERS BEHEER ────────────────────────────────────

// Lijst alle beheerders (elke beheerder mag dit zien)
app.get('/api/admin/admins', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const d = readJSON(ADMINS_FILE);
  const safe = (d.admins || []).map(({ password: _, twoFactorSecret: __, ...a }) => a);
  res.json(safe);
});

// Nieuwe beheerder aanmaken (alleen hoofdbeheerder)
app.post('/api/admin/admins', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  if (!admin.isSuperAdmin) return res.status(403).json({ error: 'Alleen de hoofdbeheerder kan nieuwe beheerders aanmaken' });
  const username    = sanitize(req.body.username, 100);
  const password    = sanitize(req.body.password, 200);
  const displayName = sanitize(req.body.displayName, 100);
  if (!username || !password) return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht' });
  if (password.length < 6) return res.status(400).json({ error: 'Wachtwoord te kort (min. 6 tekens)' });
  if (!/^[a-zA-Z0-9_\-.]+$/.test(username)) return res.status(400).json({ error: 'Gebruikersnaam mag alleen letters, cijfers, -, _ en . bevatten' });
  const d = readJSON(ADMINS_FILE);
  if (!d.admins) d.admins = [];
  if (d.admins.find(a => a.username === username)) return res.status(409).json({ error: 'Gebruikersnaam al in gebruik' });
  const newAdmin = { id: generateId(), username, displayName: displayName || username, password: hashPassword(password), isSuperAdmin: false, twoFactorSecret: null, twoFactorEnabled: false, createdAt: new Date().toISOString() };
  d.admins.push(newAdmin);
  writeJSON(ADMINS_FILE, d);
  const { password: _, twoFactorSecret: __, ...safe } = newAdmin;
  res.status(201).json(safe);
});

// Beheerder verwijderen (alleen hoofdbeheerder, kan zichzelf of hoofdbeheerder niet verwijderen)
app.delete('/api/admin/admins/:id', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  if (!admin.isSuperAdmin) return res.status(403).json({ error: 'Alleen de hoofdbeheerder kan beheerders verwijderen' });
  const d = readJSON(ADMINS_FILE);
  const target = (d.admins || []).find(a => a.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Niet gevonden' });
  if (target.id === admin.id) return res.status(400).json({ error: 'Je kunt je eigen account niet verwijderen' });
  if (target.isSuperAdmin) return res.status(400).json({ error: 'Hoofdbeheerder kan niet worden verwijderd' });
  d.admins = d.admins.filter(a => a.id !== req.params.id);
  writeJSON(ADMINS_FILE, d);
  res.json({ success: true });
});

// Reset 2FA van een andere beheerder (alleen hoofdbeheerder)
app.post('/api/admin/admins/:id/reset-2fa', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  if (!admin.isSuperAdmin && admin.id !== req.params.id)
    return res.status(403).json({ error: 'Alleen de hoofdbeheerder kan 2FA van anderen resetten' });
  const d = readJSON(ADMINS_FILE);
  const target = (d.admins || []).find(a => a.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Niet gevonden' });
  target.twoFactorEnabled = false;
  target.twoFactorSecret  = null;
  writeJSON(ADMINS_FILE, d);
  res.json({ ok: true });
});

// ─── CATCH-ALL / 404 ──────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Niet gevonden' });
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// ─── MIGRATIE: enkel admin → multi-admin ──────────────────
// Eenmalig: lees het wachtwoord uit admin.json (of env) en maak een
// eerste superadmin in admins.json als die nog leeg is.
function migrateToMultiAdmin() {
  try {
    const d = readJSON(ADMINS_FILE);
    if (d.admins && d.admins.length > 0) return; // al gemigreerd
    const old = fs.existsSync(ADMIN_FILE) ? readJSON(ADMIN_FILE) : {};
    // Gebruik bestaand gehasht wachtwoord, of hash het env/default wachtwoord
    let pass = old.password;
    if (!pass) {
      const raw = process.env.ADMIN_PASSWORD || TEACHER_PASS;
      pass = hashPassword(raw);
    }
    const first = {
      id: generateId(),
      username: 'beheerder',
      displayName: 'Hoofdbeheerder',
      password: pass,
      isSuperAdmin: true,
      twoFactorSecret:  old.twoFactorSecret  || null,
      twoFactorEnabled: !!(old.twoFactorEnabled && old.twoFactorSecret),
      createdAt: new Date().toISOString(),
    };
    writeJSON(ADMINS_FILE, { admins: [first] });
    console.log('✅ Admin migratie voltooid — gebruikersnaam: beheerder');
  } catch (e) { console.error('Admin migratie fout:', e); }
}

// ─── START ────────────────────────────────────────────────
migratePasswords();
migrateToMultiAdmin();
app.listen(PORT, () => console.log(`LeerKracht draait op poort ${PORT}`));
