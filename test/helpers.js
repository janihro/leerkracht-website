const path = require('path');
const fs = require('fs');
const os = require('os');

function startServer({ port, adminPassword = 'testadmin123', teacherPassword = 'testteacher123' }) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nonf-test-data-'));
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nonf-test-uploads-'));
  process.env.PORT = String(port);
  process.env.DATA_DIR = dataDir;
  process.env.UPLOADS_DIR = uploadsDir;
  process.env.ADMIN_PASSWORD = adminPassword;
  process.env.TEACHER_PASSWORD = teacherPassword;
  // Geen SMTP-gegevens in tests — mailer.js slaat versturen dan netjes over.
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  const server = require(path.join(__dirname, '..', 'server.js'));
  return { baseUrl: `http://localhost:${port}`, dataDir, uploadsDir, server };
}

async function waitForServer(baseUrl, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(baseUrl + '/api/settings');
      if (res.ok) return;
    } catch { /* server nog niet klaar, opnieuw proberen */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Server kwam niet op tijd online voor tests');
}

module.exports = { startServer, waitForServer };
