const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'questions.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ questions: [] }, null, 2));
}

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { questions: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// GET all questions (optionally filter by user email)
app.get('/api/questions', (req, res) => {
  const data = readData();
  const { email } = req.query;
  const questions = email
    ? data.questions.filter(q => q.askedBy === email)
    : data.questions;
  res.json(questions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

// POST new question
app.post('/api/questions', (req, res) => {
  const { lessonId, lessonTitle, question, askedBy, childName } = req.body;
  if (!lessonId || !question || !askedBy) {
    return res.status(400).json({ error: 'Vereiste velden ontbreken' });
  }
  const data = readData();
  const newQuestion = {
    id: generateId(),
    lessonId,
    lessonTitle: lessonTitle || lessonId,
    question: question.trim(),
    askedBy,
    childName: childName || 'Onbekend',
    timestamp: new Date().toISOString(),
    answer: null,
    answeredAt: null
  };
  data.questions.push(newQuestion);
  writeData(data);
  res.status(201).json(newQuestion);
});

// POST answer to a question (teacher)
app.post('/api/questions/:id/answer', (req, res) => {
  const { answer, teacherPassword } = req.body;
  const TEACHER_PASS = process.env.TEACHER_PASSWORD || 'leerkracht2026';
  if (teacherPassword !== TEACHER_PASS) {
    return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  }
  if (!answer || !answer.trim()) {
    return res.status(400).json({ error: 'Antwoord mag niet leeg zijn' });
  }
  const data = readData();
  const q = data.questions.find(q => q.id === req.params.id);
  if (!q) return res.status(404).json({ error: 'Vraag niet gevonden' });
  q.answer = answer.trim();
  q.answeredAt = new Date().toISOString();
  writeData(data);
  res.json(q);
});

// DELETE a question (teacher only)
app.delete('/api/questions/:id', (req, res) => {
  const { teacherPassword } = req.body;
  const TEACHER_PASS = process.env.TEACHER_PASSWORD || 'leerkracht2026';
  if (teacherPassword !== TEACHER_PASS) {
    return res.status(401).json({ error: 'Ongeldig wachtwoord' });
  }
  const data = readData();
  data.questions = data.questions.filter(q => q.id !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`LeerKracht website draait op poort ${PORT}`);
});
