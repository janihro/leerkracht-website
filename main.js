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
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    const akkoord = contactForm.querySelector('#akkoord');
    if (akkoord && !akkoord.checked) {
      akkoord.closest('.form-check').style.color = 'var(--accent)';
      return;
    }
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
// PORTAAL LOGIN
// ===========================
const loginForm = document.getElementById('login-form');
if (loginForm) {
  const loginBtn = loginForm.querySelector('button[type="submit"]');
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = loginForm.querySelector('input[type="email"]').value;
    const pass = loginForm.querySelector('input[type="password"]').value;
    if (!email || !pass) return;

    if (loginBtn) {
      loginBtn.textContent = 'Inloggen...';
      loginBtn.disabled = true;
    }
    setTimeout(() => {
      sessionStorage.setItem('portaal_user', email);
      window.location.href = 'portaal-dashboard.html';
    }, 600);
  });
}

// ===========================
// PORTAAL UITLOGGEN
// ===========================
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', e => {
    e.preventDefault();
    sessionStorage.removeItem('portaal_user');
    window.location.href = 'portaal.html';
  });
}

// ===========================
// DASHBOARD GUARD & NAME
// ===========================
if (document.body.classList.contains('dashboard-page')) {
  const user = sessionStorage.getItem('portaal_user');
  if (!user) {
    window.location.href = 'portaal.html';
  } else {
    const name = user.split('@')[0].charAt(0).toUpperCase() + user.split('@')[0].slice(1);
    document.querySelectorAll('.dash-user-name, #dashboard-name').forEach(el => el.textContent = name);
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
