const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const TEACHER_PASS = process.env.TEACHER_PASSWORD || 'leerkracht2026';

// Ensure data directories exist
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
[DATA_DIR, UPLOADS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const FILES_META = path.join(DATA_DIR, 'files.json');

if (!fs.existsSync(QUESTIONS_FILE)) fs.writeFileSync(QUESTIONS_FILE, JSON.stringify({ questions: [] }, null, 2));
if (!fs.existsSync(FILES_META)) fs.writeFileSync(FILES_META, JSON.stringify({ files: [] }, null, 2));

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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`LeerKracht website draait op poort ${PORT}`));
