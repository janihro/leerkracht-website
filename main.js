// ===========================
// SITE SETTINGS — laad vanuit /api/settings
// Werkt op elke pagina: naam, contact, socials
// ===========================
(async function applySettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const s = await res.json();

    // ── Website naam ──────────────────────────────
    if (s.siteName) {
      // Nav logo tekst
      document.querySelectorAll('.logo span').forEach(el => {
        el.textContent = s.siteName;
      });
      // Footer logo tekst (text node naast img)
      document.querySelectorAll('.footer-logo-wrap').forEach(el => {
        el.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent = ' ' + s.siteName;
          }
        });
      });
      // Copyright in footer
      document.querySelectorAll('.footer-bottom p').forEach(el => {
        el.textContent = el.textContent.replace(/LeerKracht/, s.siteName);
      });
      // Browser tabblad titel
      document.title = document.title.replace(/LeerKracht/, s.siteName);
    }

    // ── Slogan ────────────────────────────────────
    if (s.slogan) {
      document.querySelectorAll('[data-setting="slogan"]').forEach(el => {
        el.textContent = s.slogan;
      });
    }

    // ── Contactgegevens in footer ─────────────────
    if (s.email) {
      document.querySelectorAll('.footer-contact .fa-envelope').forEach(i => {
        const li = i.closest('li');
        if (li) li.innerHTML = `<i class="fas fa-envelope"></i> <a href="mailto:${s.email}" style="color:inherit;">${s.email}</a>`;
      });
    }
    if (s.telefoon) {
      document.querySelectorAll('.footer-contact .fa-phone').forEach(i => {
        const li = i.closest('li');
        if (li) li.innerHTML = `<i class="fas fa-phone"></i> ${s.telefoon}`;
      });
    }
    if (s.adres) {
      // Vervang het eerste locatie-item en verwijder eventuele extra items
      // (voorkomt duplicaten als er meerdere fa-map-marker-alt li's zijn)
      const markers = [...document.querySelectorAll('.footer-contact .fa-map-marker-alt')];
      markers.forEach((icon, idx) => {
        const li = icon.closest('li');
        if (!li) return;
        if (idx === 0) li.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${s.adres}`;
        else li.remove();
      });
    }

    // ── Sociale media links ───────────────────────
    if (s.instagram && s.instagram !== '#') {
      document.querySelectorAll('.socials .fa-instagram, .socials-row .fa-instagram').forEach(i => {
        const a = i.closest('a'); if (a) a.href = s.instagram;
      });
    }
    if (s.facebook && s.facebook !== '#') {
      document.querySelectorAll('.socials .fa-facebook-f, .socials-row .fa-facebook-f').forEach(i => {
        const a = i.closest('a'); if (a) a.href = s.facebook;
      });
    }
    if (s.tiktok && s.tiktok !== '#') {
      document.querySelectorAll('.socials .fa-tiktok, .socials-row .fa-tiktok').forEach(i => {
        const a = i.closest('a'); if (a) a.href = s.tiktok;
      });
    }
    if (s.whatsapp) {
      let wa = s.whatsapp.replace(/[^0-9]/g, '');
      if (wa.startsWith('0')) wa = '31' + wa.slice(1); // 0681... → 31681...
      document.querySelectorAll('.socials .fa-whatsapp, .socials-row .fa-whatsapp').forEach(i => {
        const a = i.closest('a');
        if (a) { a.href = `https://wa.me/${wa}`; a.target = '_blank'; a.rel = 'noopener'; }
      });
    }

    // ── Openingstijden op contact pagina ──────────
    if (s.openingstijden) {
      document.querySelectorAll('[data-setting="openingstijden"]').forEach(el => {
        el.textContent = s.openingstijden;
      });
    }

  } catch { /* stil falen — website werkt gewoon met vaste tekst */ }
})();

// ===========================
// NAVBAR scroll effect
// ===========================
const navbar = document.getElementById('navbar');
if (navbar) {
  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ===========================
// HAMBURGER MENU
// ===========================
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('nav-links');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    hamburger.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  document.addEventListener('click', e => {
    if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
      hamburger.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('open');
      document.body.style.overflow = '';
    });
  });
}

// ===========================
// SCROLL ANIMATIONS
// ===========================
const animObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      animObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('[data-animate]').forEach(el => animObserver.observe(el));

// ===========================
// FAQ ACCORDION
// ===========================
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const answer = btn.nextElementSibling;
    const isOpen = btn.classList.contains('open');
    document.querySelectorAll('.faq-q').forEach(b => {
      b.classList.remove('open');
      if (b.nextElementSibling) b.nextElementSibling.classList.remove('open');
    });
    if (!isOpen) {
      btn.classList.add('open');
      answer.classList.add('open');
    }
  });
});

// ===========================
// CONTACT FORM
// ===========================
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async e => {
    e.preventDefault();
    const akkoord = contactForm.querySelector('#akkoord');
    if (akkoord && !akkoord.checked) {
      akkoord.closest('.form-check').style.color = 'var(--accent)';
      return;
    }
    const btn = contactForm.querySelector('button[type=submit]');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Versturen...';

    try {
      await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voornaam: contactForm.querySelector('#voornaam')?.value || '',
          achternaam: contactForm.querySelector('#achternaam')?.value || '',
          email: contactForm.querySelector('#email')?.value || '',
          telefoon: contactForm.querySelector('#telefoon')?.value || '',
          kindNaam: contactForm.querySelector('#kind-naam')?.value || '',
          leerjaar: contactForm.querySelector('#leerjaar')?.value || '',
          vak: contactForm.querySelector('#vak')?.value || '',
          bericht: contactForm.querySelector('#bericht')?.value || '',
        })
      });
    } catch { /* toon succes ook als API faalt */ }

    btn.disabled = false;
    btn.innerHTML = origHtml;
    const msg = document.getElementById('success-msg');
    if (msg) {
      msg.classList.add('show');
      contactForm.reset();
      msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => msg.classList.remove('show'), 6000);
    }
  });
}

// ===========================
// PORTAAL UITLOGGEN
// ===========================
function portaalLogout() {
  localStorage.removeItem('ouder_email');
  localStorage.removeItem('ouder_kindNaam');
  localStorage.removeItem('ouder_name');
  localStorage.removeItem('ouder_pass');
  window.location.href = 'portaal.html';
}
document.querySelectorAll('#logout-btn, #logout-btn-side').forEach(btn => {
  btn.addEventListener('click', e => { e.preventDefault(); portaalLogout(); });
});

// ===========================
// DASHBOARD GUARD & NAME
// ===========================
if (document.body.classList.contains('dashboard-page')) {
  const email = localStorage.getItem('ouder_email');
  if (!email) {
    window.location.href = 'portaal.html';
  } else {
    const kindNaam = localStorage.getItem('ouder_kindNaam') || '';
    const name = localStorage.getItem('ouder_name') || email.split('@')[0];
    document.querySelectorAll('.dash-user-name, #dashboard-name').forEach(el => el.textContent = name);
    document.querySelectorAll('.dash-kind-naam').forEach(el => el.textContent = kindNaam);
  }
}

// ===========================
// WINKELWAGEN
// ===========================
function getCart() { return JSON.parse(localStorage.getItem('lk_cart') || '[]'); }
function saveCart(c) { localStorage.setItem('lk_cart', JSON.stringify(c)); }
function cartTotal(c) { return c.reduce((s, i) => s + i.qty, 0); }

function updateAllCartCounts() {
  const total = cartTotal(getCart());
  document.querySelectorAll('.cart-count').forEach(el => {
    el.textContent = total;
    el.style.display = total ? 'flex' : 'none';
  });
}
updateAllCartCounts();

document.querySelectorAll('.btn-add').forEach(btn => {
  btn.addEventListener('click', () => {
    const card = btn.closest('.shop-card');
    if (!card) return;
    const name = card.querySelector('h3')?.textContent || 'Product';
    const price = card.querySelector('.shop-price')?.textContent || '€0';
    const cart = getCart();
    const existing = cart.find(i => i.name === name);
    if (existing) existing.qty++;
    else cart.push({ name, price, qty: 1 });
    saveCart(cart);
    updateAllCartCounts();
    btn.textContent = '✓ Toegevoegd';
    btn.style.background = 'linear-gradient(135deg, var(--green), #04b388)';
    setTimeout(() => {
      btn.textContent = 'In mandje';
      btn.style.background = '';
    }, 1800);
  });
});

// ===========================
// SMOOTH SCROLL (anchor links)
// ===========================
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id === '#') return;
    const target = document.querySelector(id);
    if (target) {
      e.preventDefault();
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || '72') + 16;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ===========================
// PROGRESS BAR ANIMATION
// ===========================
const progObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.prog-fill').forEach(bar => {
        const w = bar.getAttribute('data-width');
        if (w) bar.style.width = w;
      });
      progObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.prog-card').forEach(c => progObserver.observe(c));

// ===========================
// FILTER BUTTONS (webshop)
// ===========================
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});
