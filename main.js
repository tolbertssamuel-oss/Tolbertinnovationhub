document.querySelectorAll('form.form-card').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const feedback = form.querySelector('.form-feedback');
    const message = form.dataset.successMessage || 'Form submitted successfully.';

    if (!form.checkValidity()) {
      feedback.textContent = 'Please complete all required fields before submitting.';
      feedback.style.color = '#b42318';
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const entries = Object.fromEntries(data.entries());
    console.log('Form submission preview:', entries);

    feedback.textContent = message;
    feedback.style.color = '#0b5a32';
    form.reset();
  });
});

const navWrap = document.querySelector('.nav-wrap');
const navLinks = navWrap?.querySelector('.nav-links');

if (navWrap && navLinks) {
  if (!navLinks.id) {
    navLinks.id = 'primary-navigation';
  }

  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'menu-toggle';
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-controls', navLinks.id);
  menuButton.setAttribute('aria-label', 'Toggle navigation menu');
  menuButton.innerHTML = '<span aria-hidden="true">☰</span> Menu';

  const brand = navWrap.querySelector('.brand');
  if (brand) {
    brand.insertAdjacentElement('afterend', menuButton);
  } else {
    navWrap.prepend(menuButton);
  }

  const closeMenu = () => {
    navWrap.classList.remove('nav-open');
    menuButton.setAttribute('aria-expanded', 'false');
  };

  menuButton.addEventListener('click', () => {
    const shouldOpen = !navWrap.classList.contains('nav-open');
    navWrap.classList.toggle('nav-open', shouldOpen);
    menuButton.setAttribute('aria-expanded', String(shouldOpen));
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 920) {
      closeMenu();
    }
  });
}
