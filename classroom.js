const navWrap = document.querySelector('.nav-wrap');
const navLinks = navWrap?.querySelector('.nav-links');

if (navWrap && navLinks) {
  if (!navLinks.id) navLinks.id = 'primary-navigation';
  let menuButton = navWrap.querySelector('.menu-toggle');

  if (!menuButton) {
    menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'menu-toggle';
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-controls', navLinks.id);
    menuButton.innerHTML = '<span aria-hidden="true">☰</span>&nbsp;Menu';
    navWrap.append(menuButton);
  }

  menuButton.addEventListener('click', () => {
    const open = !navWrap.classList.contains('nav-open');
    navWrap.classList.toggle('nav-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 920) {
      navWrap.classList.remove('nav-open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });
}

const progressConfig = {
  ielts: { total: 12, next: 'lesson-ielts-orientation.html' },
  toefl: { total: 12, next: 'lesson-toefl-orientation.html' }
};

function loadProgress(track) {
  const key = `classroom_progress_${track}`;
  return Number(localStorage.getItem(key) || 0);
}

function saveProgress(track, value) {
  const key = `classroom_progress_${track}`;
  localStorage.setItem(key, String(value));
}

function renderDashboard() {
  document.querySelectorAll('[data-progress-track]').forEach((card) => {
    const track = card.dataset.progressTrack;
    const cfg = progressConfig[track];
    if (!cfg) return;

    const completed = loadProgress(track);
    const percent = Math.min(100, Math.round((completed / cfg.total) * 100));

    const fill = card.querySelector('.progress-fill');
    const label = card.querySelector('.progress-label');
    const next = card.querySelector('.next-lesson-link');

    if (fill) fill.style.width = `${percent}%`;
    if (label) label.textContent = `${completed}/${cfg.total} lessons complete (${percent}%)`;
    if (next) next.href = cfg.next;
  });
}

function wireLessonCompletion() {
  const markBtn = document.querySelector('[data-mark-complete]');
  if (!markBtn) return;

  markBtn.addEventListener('click', () => {
    const track = markBtn.dataset.track;
    const increment = Number(markBtn.dataset.increment || 1);
    const cfg = progressConfig[track];
    if (!cfg) return;

    const completed = Math.min(cfg.total, loadProgress(track) + increment);
    saveProgress(track, completed);

    markBtn.textContent = 'Completed ✓';
    markBtn.disabled = true;
    markBtn.classList.remove('btn-primary');
    markBtn.classList.add('btn-secondary');

    const feedback = document.querySelector('[data-completion-feedback]');
    if (feedback) {
      feedback.textContent = `Great work! Your ${track.toUpperCase()} progress is now ${completed}/${cfg.total}.`;
    }
  });
}

function wireAnswerReveal() {
  document.querySelectorAll('[data-reveal-answers]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(btn.dataset.target);
      if (!target) return;
      target.classList.add('revealed');
      btn.disabled = true;
      btn.textContent = 'Answers Revealed';
    });
  });
}

renderDashboard();
wireLessonCompletion();
wireAnswerReveal();
