document.querySelectorAll('form.form-card').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const feedback = form.querySelector('.form-feedback');
    const message = form.dataset.successMessage || 'Form submitted successfully.';

    if (!form.checkValidity()) {
      if (feedback) {
        feedback.textContent = 'Please complete all required fields before submitting.';
        feedback.style.color = '#b42318';
      }
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const entries = Object.fromEntries(data.entries());
    console.log('Form submission preview:', entries);

    if (feedback) {
      feedback.textContent = message;
      feedback.style.color = '#0b5a32';
    }
    form.reset();
  });
});

document.querySelectorAll('.nav-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const navWrap = button.closest('.nav-wrap');
    const nav = navWrap ? navWrap.querySelector('.nav-links') : null;
    if (!nav) return;

    const isOpen = nav.classList.toggle('open');
    button.setAttribute('aria-expanded', String(isOpen));
    button.textContent = isOpen ? 'Close' : 'Menu';
  });
});
