const nodemailer = require('nodemailer');

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'info@nosorguyonosfuturo.nl';

let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.mijndomein.nl',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // STARTTLS op poort 587
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.log(`[mail] SMTP niet geconfigureerd (SMTP_USER/SMTP_PASS ontbreken) — e-mail naar ${to} overgeslagen: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
  } catch (err) {
    console.error(`[mail] Versturen naar ${to} mislukt:`, err.message);
  }
}

function sendRegistrationEmails(reg) {
  const naamOuder = `${reg.voornaam} ${reg.achternaam}`.trim();
  const naamKind = escapeHtml(reg.kindNaam);

  sendMail({
    to: NOTIFY_EMAIL,
    subject: `Nieuwe inschrijving: ${reg.kindNaam}`,
    html: `
      <p>Er is een nieuwe inschrijving binnengekomen via de website.</p>
      <ul>
        <li><strong>Ouder:</strong> ${escapeHtml(naamOuder)}</li>
        <li><strong>E-mail:</strong> ${escapeHtml(reg.email)}</li>
        <li><strong>Telefoon:</strong> ${escapeHtml(reg.telefoon) || '-'}</li>
        <li><strong>Kind:</strong> ${naamKind}</li>
        <li><strong>Leeftijd:</strong> ${escapeHtml(reg.leeftijd) || '-'}</li>
        <li><strong>Vak:</strong> ${escapeHtml(reg.vak) || '-'}</li>
        <li><strong>Bericht:</strong> ${escapeHtml(reg.bericht) || '-'}</li>
      </ul>
    `,
  });

  sendMail({
    to: reg.email,
    subject: 'Bedankt voor je inschrijving bij Nos Orguyo, Nos Futuro',
    html: `
      <p>Beste ${escapeHtml(reg.voornaam)},</p>
      <p>Bedankt voor de inschrijving van ${naamKind}. We hebben je aanmelding in goede orde ontvangen en gaan er zo snel mogelijk mee aan de slag.</p>
      <p>Heb je in de tussentijd vragen? Neem gerust contact met ons op via <a href="mailto:info@nosorguyonosfuturo.nl">info@nosorguyonosfuturo.nl</a>.</p>
      <p>Met vriendelijke groet,<br>Nos Orguyo, Nos Futuro</p>
    `,
  });
}

module.exports = { sendRegistrationEmails };
