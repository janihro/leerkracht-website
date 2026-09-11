const nodemailer = require('nodemailer');
const dns = require('dns').promises;

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'info@nosorguyonosfuturo.nl';
const SMTP_HOST     = process.env.SMTP_HOST || 'mail.mijndomein.nl';
const SMTP_PORT     = Number(process.env.SMTP_PORT) || 587;

let cachedTransporter = null;

// Railway heeft geen uitgaande IPv6-route naar mail.mijndomein.nl, en de socket-optie
// `family: 4` wordt door nodemailer niet doorgegeven aan de onderliggende connectie.
// Daarom lossen we het IPv4-adres hier zelf op en verbinden we daar direct mee,
// met `tls.servername` zodat de certificaatcontrole nog wel op de echte hostnaam draait.
async function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (cachedTransporter) return cachedTransporter;

  let host = SMTP_HOST;
  try {
    const addresses = await dns.resolve4(SMTP_HOST);
    if (addresses[0]) host = addresses[0];
  } catch (err) {
    console.error(`[mail] IPv4-lookup voor ${SMTP_HOST} mislukt, val terug op hostnaam:`, err.message);
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port: SMTP_PORT,
    secure: false, // STARTTLS op poort 587
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { servername: SMTP_HOST },
  });
  return cachedTransporter;
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function sendMail({ to, subject, html }) {
  const transporter = await getTransporter();
  if (!transporter) {
    console.log(`[mail] SMTP niet geconfigureerd (SMTP_USER/SMTP_PASS ontbreken) — e-mail naar ${to} overgeslagen: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
    console.log(`[mail] Verstuurd naar ${to}: ${subject}`);
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

function sendPasswordSetupEmail({ to, naam, link }) {
  sendMail({
    to,
    subject: 'Stel je wachtwoord in — Nos Orguyo, Nos Futuro',
    html: `
      <p>Beste${naam ? ' ' + escapeHtml(naam) : ''},</p>
      <p>Er is een portaalaccount voor je aangemaakt bij Nos Orguyo, Nos Futuro. Klik op onderstaande link om zelf een wachtwoord in te stellen:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Deze link is 48 uur geldig.</p>
      <p>Met vriendelijke groet,<br>Nos Orguyo, Nos Futuro</p>
    `,
  });
}

function sendPasswordResetEmail({ to, naam, link }) {
  sendMail({
    to,
    subject: 'Wachtwoord opnieuw instellen — Nos Orguyo, Nos Futuro',
    html: `
      <p>Beste${naam ? ' ' + escapeHtml(naam) : ''},</p>
      <p>Je hebt aangegeven je wachtwoord voor het portaal te zijn vergeten. Klik op onderstaande link om een nieuw wachtwoord in te stellen:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Deze link is 1 uur geldig. Heb je dit niet zelf aangevraagd? Dan kun je deze e-mail gewoon negeren.</p>
      <p>Met vriendelijke groet,<br>Nos Orguyo, Nos Futuro</p>
    `,
  });
}

module.exports = { sendRegistrationEmails, sendPasswordSetupEmail, sendPasswordResetEmail };
