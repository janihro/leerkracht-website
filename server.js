const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const TEACHER_PASS = process.env.TEACHER_PASSWORD || 'leerkracht2026';

// Persistent storage — on Railway: mount a Volume at /app/storage
// Set DATA_DIR and UPLOADS_DIR env vars to point into the volume
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
[DATA_DIR, UPLOADS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const QUESTIONS_FILE    = path.join(DATA_DIR, 'questions.json');
const FILES_META        = path.join(DATA_DIR, 'files.json');
const REGISTRATIONS_FILE= path.join(DATA_DIR, 'registrations.json');
const REVIEWS_FILE      = path.join(DATA_DIR, 'reviews.json');
const SETTINGS_FILE     = path.join(DATA_DIR, 'settings.json');
const ACCOUNTS_FILE     = path.join(DATA_DIR, 'accounts.json');
const ADMIN_FILE        = path.join(DATA_DIR, 'admin.json');
const GALLERY_FILE      = path.join(DATA_DIR, 'gallery.json');
const PRODUCTS_FILE     = path.join(DATA_DIR, 'products.json');

if (!fs.existsSync(QUESTIONS_FILE))     fs.writeFileSync(QUESTIONS_FILE,     JSON.stringify({ questions: [] }, null, 2));
if (!fs.existsSync(FILES_META))         fs.writeFileSync(FILES_META,         JSON.stringify({ files: [] }, null, 2));
if (!fs.existsSync(REGISTRATIONS_FILE)) fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify({ registrations: [] }, null, 2));
if (!fs.existsSync(REVIEWS_FILE))       fs.writeFileSync(REVIEWS_FILE,       JSON.stringify({ reviews: [] }, null, 2));
if (!fs.existsSync(ACCOUNTS_FILE))      fs.writeFileSync(ACCOUNTS_FILE,      JSON.stringify({ accounts: [] }, null, 2));
if (!fs.existsSync(GALLERY_FILE))       fs.writeFileSync(GALLERY_FILE,       JSON.stringify({ items: [] }, null, 2));
if (!fs.existsSync(PRODUCTS_FILE))      fs.writeFileSync(PRODUCTS_FILE,      JSON.stringify({ products: [] }, null, 2));
if (!fs.existsSync(SETTINGS_FILE))      fs.writeFileSync(SETTINGS_FILE,      JSON.stringify({
  siteName: 'LeerKracht',
  slogan: 'Nos Orguyo, Nos Futuro',
  email: 'info@leerkracht.nl',
  telefoon: '06 — XX XX XX XX',
  whatsapp: '',
  adres: '[Straatnaam], [Stad]',
  openingstijden: 'Ma–vr: 9:00–19:00 · Za: 10:00–14:00',
  instagram: '#',
  facebook: '#',
  tiktok: '#',
}, null, 2));

// Admin password: stored in admin.json, overridable via env, default fallback
function getAdminPass() {
  try {
    const d = readJSON(ADMIN_FILE);
    return d.password || process.env.ADMIN_PASSWORD || TEACHER_PASS;
  } catch { return process.env.ADMIN_PASSWORD || TEACHER_PASS; }
}

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// Multer storage — keep original extension, safe filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, generateId() + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
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
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Bestandstype niet toegestaan'));
    }
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));
// Serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR));

// ─── AUTH CHECK ────────────────────────────────────────────
app.post('/api/verify-password', (req, res) => {
  const { teacherPassword } = req.body;
  if (teacherPassword === TEACHER_PASS) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false });
  }
});

// ─── Q&A API ───────────────────────────────────────────────

app.get('/api/questions', (req, res) => {
  const data = readJSON(QUESTIONS_FILE);
  const { email } = req.query;
  const questions = email
    ? (data.questions || []).filter(q => q.askedBy === email)
    : (data.questions || []);
  res.json(questions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

app.post('/api/questions', (req, res) => {
  const { lessonId, lessonTitle, question, askedBy, childName } = req.body;
  if (!lessonId || !question || !askedBy) return res.status(400).json({ error: 'Vereiste velden ontbreken' });
  const data = readJSON(QUESTIONS_FILE);
  if (!data.questions) data.questions = [];
  const q = { id: generateId(), lessonId, lessonTitle: lessonTitle || lessonId, question: question.trim(), askedBy, childName: childName || 'Onbekend', timestamp: new Date().toISOString(), answer: null, answeredAt: null };
  data.questions.push(q);
  writeJSON(QUESTIONS_FILE, data);
  res.status(201).json(q);
});

app.post('/api/questions/:id/answer', (req, res) => {
  const { answer, teacherPassword } = req.body;
  if (teacherPassword !== TEACHER_PASS) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  if (!answer?.trim()) return res.status(400).json({ error: 'Antwoord mag niet leeg zijn' });
  const data = readJSON(QUESTIONS_FILE);
  const q = (data.questions || []).find(q => q.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Vraag niet gevonden' });
  q.answer = answer.trim();
  q.answeredAt = new Date().toISOString();
  writeJSON(QUESTIONS_FILE, data);
  res.json(q);
});

app.delete('/api/questions/:id', (req, res) => {
  const { teacherPassword } = req.body;
  if (teacherPassword !== TEACHER_PASS) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(QUESTIONS_FILE);
  data.questions = (data.questions || []).filter(q => q.id !== req.params.id);
  writeJSON(QUESTIONS_FILE, data);
  res.json({ success: true });
});

// ─── FILES API ─────────────────────────────────────────────

// GET all files (optional ?vak= filter)
app.get('/api/files', (req, res) => {
  const data = readJSON(FILES_META);
  let files = (data.files || []).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  if (req.query.vak) files = files.filter(f => f.vak === req.query.vak);
  res.json(files);
});

// POST upload file (teacher only)
app.post('/api/files', (req, res) => {
  const teacherPassword = req.headers['x-teacher-password'];
  if (teacherPassword !== TEACHER_PASS) return res.status(401).json({ error: 'Ongeldig wachtwoord' });

  upload.single('file')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Geen bestand ontvangen' });

    const { title, description, vak } = req.body;
    const data = readJSON(FILES_META);
    if (!data.files) data.files = [];

    const meta = {
      id: generateId(),
      title: title || req.file.originalname,
      description: description || '',
      vak: vak || 'Algemeen',
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: '/uploads/' + req.file.filename,
      uploadedAt: new Date().toISOString(),
    };
    data.files.push(meta);
    writeJSON(FILES_META, data);
    res.status(201).json(meta);
  });
});

// DELETE file (teacher only)
app.delete('/api/files/:id', (req, res) => {
  const { teacherPassword } = req.body;
  if (teacherPassword !== TEACHER_PASS) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(FILES_META);
  const file = (data.files || []).find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'Bestand niet gevonden' });
  // Remove physical file
  const filePath = path.join(UPLOADS_DIR, file.storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  data.files = data.files.filter(f => f.id !== req.params.id);
  writeJSON(FILES_META, data);
  res.json({ success: true });
});

// ─── REVIEWS API ──────────────────────────────────────────

app.get('/api/reviews', (req, res) => {
  const data = readJSON(REVIEWS_FILE);
  const reviews = (data.reviews || []).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(reviews);
});

app.post('/api/reviews', (req, res) => {
  const { name, role, rating, text } = req.body;
  if (!name?.trim() || !text?.trim() || !rating) return res.status(400).json({ error: 'Vereiste velden ontbreken' });
  const data = readJSON(REVIEWS_FILE);
  if (!data.reviews) data.reviews = [];
  const review = {
    id: generateId(),
    name: name.trim(),
    role: (role || '').trim(),
    rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
    text: text.trim(),
    submittedAt: new Date().toISOString(),
  };
  data.reviews.push(review);
  writeJSON(REVIEWS_FILE, data);
  res.status(201).json(review);
});

app.delete('/api/reviews/:id', (req, res) => {
  const { teacherPassword } = req.body;
  if (teacherPassword !== TEACHER_PASS) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(REVIEWS_FILE);
  data.reviews = (data.reviews || []).filter(r => r.id !== req.params.id);
  writeJSON(REVIEWS_FILE, data);
  res.json({ success: true });
});

// ─── REGISTRATIONS API ────────────────────────────────────

// GET all registrations (teacher only)
app.get('/api/registrations', (req, res) => {
  const { teacherPassword } = req.query;
  if (teacherPassword !== TEACHER_PASS) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(REGISTRATIONS_FILE);
  const list = (data.registrations || []).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(list);
});

// POST new registration (public)
app.post('/api/registrations', (req, res) => {
  const { voornaam, achternaam, email, telefoon, kindNaam, leeftijd, leerjaar, vak, bericht } = req.body;
  if (!voornaam || !email || !kindNaam) return res.status(400).json({ error: 'Vereiste velden ontbreken' });
  const data = readJSON(REGISTRATIONS_FILE);
  if (!data.registrations) data.registrations = [];
  const reg = {
    id: generateId(),
    voornaam, achternaam, email,
    telefoon: telefoon || '',
    kindNaam, leeftijd: leeftijd || leerjaar || '', vak,
    bericht: bericht || '',
    status: 'nieuw',
    submittedAt: new Date().toISOString(),
  };
  data.registrations.push(reg);
  writeJSON(REGISTRATIONS_FILE, data);
  res.status(201).json(reg);
});

// PATCH status (teacher only)
app.patch('/api/registrations/:id', (req, res) => {
  const { teacherPassword, status } = req.body;
  if (teacherPassword !== TEACHER_PASS) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const allowed = ['nieuw', 'contact opgenomen', 'ingeschreven', 'afgewezen'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Ongeldige status' });
  const data = readJSON(REGISTRATIONS_FILE);
  const reg = (data.registrations || []).find(r => r.id === req.params.id);
  if (!reg) return res.status(404).json({ error: 'Niet gevonden' });
  reg.status = status;
  writeJSON(REGISTRATIONS_FILE, data);
  res.json(reg);
});

// DELETE registration (teacher only)
app.delete('/api/registrations/:id', (req, res) => {
  const { teacherPassword } = req.body;
  if (teacherPassword !== TEACHER_PASS) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(REGISTRATIONS_FILE);
  data.registrations = (data.registrations || []).filter(r => r.id !== req.params.id);
  writeJSON(REGISTRATIONS_FILE, data);
  res.json({ success: true });
});

// ─── PARENT ACCOUNT LOGIN ─────────────────────────────────
app.post('/api/verify-parent', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ ok: false });
  const data = readJSON(ACCOUNTS_FILE);
  const account = (data.accounts || []).find(a => a.email === email && a.password === password);
  if (account) res.json({ ok: true, kindNaam: account.kindNaam, name: account.name });
  else res.status(401).json({ ok: false });
});

// ─── ADMIN API ────────────────────────────────────────────
// All admin routes require admin password in body or header

function adminAuth(req) {
  const pass = req.body?.adminPassword || req.headers['x-admin-password'] || req.query?.adminPassword;
  return pass === getAdminPass();
}

// GET stats dashboard
app.get('/api/admin/stats', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const registrations = readJSON(REGISTRATIONS_FILE).registrations || [];
  const questions     = readJSON(QUESTIONS_FILE).questions || [];
  const reviews       = readJSON(REVIEWS_FILE).reviews || [];
  const files         = readJSON(FILES_META).files || [];
  const accounts      = readJSON(ACCOUNTS_FILE).accounts || [];
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

// GET / PUT website settings
app.get('/api/admin/settings', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  res.json(readJSON(SETTINGS_FILE));
});
app.put('/api/admin/settings', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const allowed = ['siteName','slogan','email','telefoon','whatsapp','adres','openingstijden','instagram','facebook','tiktok'];
  const current = readJSON(SETTINGS_FILE);
  allowed.forEach(k => { if (req.body[k] !== undefined) current[k] = req.body[k]; });
  writeJSON(SETTINGS_FILE, current);
  res.json(current);
});

// GET / POST / DELETE portal accounts
app.get('/api/admin/accounts', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(ACCOUNTS_FILE);
  // Never return passwords in list
  const safe = (data.accounts || []).map(({ password: _, ...a }) => a);
  res.json(safe);
});
app.post('/api/admin/accounts', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const { email, password, kindNaam, name } = req.body;
  if (!email || !password || !kindNaam) return res.status(400).json({ error: 'E-mail, wachtwoord en naam kind zijn verplicht' });
  const data = readJSON(ACCOUNTS_FILE);
  if (!data.accounts) data.accounts = [];
  if (data.accounts.find(a => a.email === email)) return res.status(409).json({ error: 'E-mailadres al in gebruik' });
  const account = { id: generateId(), email, password, kindNaam, name: name || '', createdAt: new Date().toISOString() };
  data.accounts.push(account);
  writeJSON(ACCOUNTS_FILE, data);
  const { password: _, ...safe } = account;
  res.status(201).json(safe);
});
app.delete('/api/admin/accounts/:id', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(ACCOUNTS_FILE);
  data.accounts = (data.accounts || []).filter(a => a.id !== req.params.id);
  writeJSON(ACCOUNTS_FILE, data);
  res.json({ success: true });
});

// POST change admin password
app.post('/api/admin/change-password', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Huidig wachtwoord onjuist' });
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Nieuw wachtwoord moet minimaal 6 tekens zijn' });
  const admin = fs.existsSync(ADMIN_FILE) ? readJSON(ADMIN_FILE) : {};
  admin.password = newPassword;
  writeJSON(ADMIN_FILE, admin);
  res.json({ success: true });
});

// GET export registrations as CSV
app.get('/api/admin/export-csv', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(REGISTRATIONS_FILE);
  const rows = data.registrations || [];
  const header = ['ID','Voornaam','Achternaam','Email','Telefoon','Kind naam','Leeftijd','Vak','Status','Bericht','Datum'];
  const csv = [header, ...rows.map(r => [
    r.id, r.voornaam, r.achternaam, r.email, r.telefoon,
    r.kindNaam, r.leeftijd, r.vak, r.status,
    (r.bericht||'').replace(/[\n\r,;"]/g,' '),
    new Date(r.submittedAt).toLocaleString('nl-NL')
  ])].map(row => row.map(v => `"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="inschrijvingen.csv"');
  res.send('﻿' + csv); // BOM for Excel
});

// ─── GALLERY API ──────────────────────────────────────────
const galleryUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Alleen afbeeldingen (jpg, png, gif, webp) zijn toegestaan'));
  }
});

// GET all gallery items (public)
app.get('/api/gallery', (req, res) => {
  const data = readJSON(GALLERY_FILE);
  const items = (data.items || []).sort((a,b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  res.json(items);
});

// POST upload gallery image (admin only)
app.post('/api/gallery', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  galleryUpload.single('image')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Geen afbeelding ontvangen' });
    const { title, description } = req.body;
    const data = readJSON(GALLERY_FILE);
    if (!data.items) data.items = [];
    const item = {
      id: generateId(),
      title: (title || '').trim() || req.file.originalname,
      description: (description || '').trim(),
      storedName: req.file.filename,
      url: '/uploads/' + req.file.filename,
      uploadedAt: new Date().toISOString(),
    };
    data.items.push(item);
    writeJSON(GALLERY_FILE, data);
    res.status(201).json(item);
  });
});

// PATCH gallery item (admin only — update title/description)
app.patch('/api/gallery/:id', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(GALLERY_FILE);
  const item = (data.items || []).find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Niet gevonden' });
  if (req.body.title !== undefined) item.title = req.body.title.trim();
  if (req.body.description !== undefined) item.description = req.body.description.trim();
  writeJSON(GALLERY_FILE, data);
  res.json(item);
});

// DELETE gallery item (admin only)
app.delete('/api/gallery/:id', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(GALLERY_FILE);
  const item = (data.items || []).find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Niet gevonden' });
  const filePath = path.join(UPLOADS_DIR, item.storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  data.items = data.items.filter(i => i.id !== req.params.id);
  writeJSON(GALLERY_FILE, data);
  res.json({ success: true });
});

// GET export reviews as CSV
app.get('/api/admin/export-reviews-csv', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const rows = readJSON(REVIEWS_FILE).reviews || [];
  const header = ['ID','Naam','Rol','Sterren','Tekst','Datum'];
  const csv = [header, ...rows.map(r => [
    r.id, r.name, r.role||'', r.rating, r.text,
    new Date(r.submittedAt).toLocaleString('nl-NL')
  ])].map(row => row.map(v=>`"${(v||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="reviews.csv"');
  res.send('﻿' + csv);
});

// ─── PRODUCTS API ─────────────────────────────────────────

// GET all products — public, only active unless ?all=1 with admin auth
app.get('/api/products', (req, res) => {
  const data = readJSON(PRODUCTS_FILE);
  let list = (data.products || []).sort((a,b) => (a.volgorde||0) - (b.volgorde||0) || new Date(a.createdAt) - new Date(b.createdAt));
  if (!(req.query.all === '1' && adminAuth(req))) {
    list = list.filter(p => p.actief !== false);
  }
  res.json(list);
});

// POST create product (admin only)
app.post('/api/products', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const { naam, beschrijving, prijs, badge, badgeKleur, categorie, icon, afbeelding, actief, volgorde } = req.body;
  if (!naam || prijs === undefined) return res.status(400).json({ error: 'Naam en prijs zijn verplicht' });
  const data = readJSON(PRODUCTS_FILE);
  if (!data.products) data.products = [];
  const product = {
    id: generateId(),
    naam: naam.trim(),
    beschrijving: (beschrijving||'').trim(),
    prijs: parseFloat(prijs) || 0,
    badge: (badge||'').trim(),
    badgeKleur: badgeKleur||'',
    categorie: (categorie||'Overig').trim(),
    icon: (icon||'fa-tag').trim(),
    afbeelding: afbeelding||null,
    actief: actief !== false,
    volgorde: parseInt(volgorde)||0,
    createdAt: new Date().toISOString(),
  };
  data.products.push(product);
  writeJSON(PRODUCTS_FILE, data);
  res.status(201).json(product);
});

// PUT update product (admin only)
app.put('/api/products/:id', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(PRODUCTS_FILE);
  const p = (data.products||[]).find(p => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Product niet gevonden' });
  const fields = ['naam','beschrijving','prijs','badge','badgeKleur','categorie','icon','afbeelding','actief','volgorde'];
  fields.forEach(k => { if (req.body[k] !== undefined) p[k] = req.body[k]; });
  if (p.prijs !== undefined) p.prijs = parseFloat(p.prijs)||0;
  writeJSON(PRODUCTS_FILE, data);
  res.json(p);
});

// DELETE product (admin only)
app.delete('/api/products/:id', (req, res) => {
  if (!adminAuth(req)) return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  const data = readJSON(PRODUCTS_FILE);
  data.products = (data.products||[]).filter(p => p.id !== req.params.id);
  writeJSON(PRODUCTS_FILE, data);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`LeerKracht website draait op poort ${PORT}`));
