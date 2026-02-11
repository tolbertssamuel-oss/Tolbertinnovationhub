const navWrap = document.querySelector('.nav-wrap');
const navLinks = navWrap?.querySelector('.nav-links');

if (navWrap && navLinks) {
  if (!navLinks.id) navLinks.id = 'classroom-navigation';

  if (!navLinks.querySelector('a[href="classroom-mastery-plan.html"]')) {
    const masteryLink = document.createElement('a');
    masteryLink.href = 'classroom-mastery-plan.html';
    masteryLink.textContent = 'Mastery Plan';
    if (window.location.pathname.endsWith('classroom-mastery-plan.html')) {
      masteryLink.classList.add('active');
    }
    navLinks.append(masteryLink);
  }

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
  ielts: { total: 12, next: 'classroom-lesson-ielts-orientation.html' },
  toefl: { total: 12, next: 'classroom-lesson-toefl-orientation.html' }
};

const getProgress = (track) => Number(localStorage.getItem(`classroom_progress_${track}`) || 0);
const setProgress = (track, value) => localStorage.setItem(`classroom_progress_${track}`, String(value));

document.querySelectorAll('[data-progress-track]').forEach((card) => {
  const track = card.dataset.progressTrack;
  const cfg = progressConfig[track];
  if (!cfg) return;

  const completed = getProgress(track);
  const percent = Math.min(100, Math.round((completed / cfg.total) * 100));
  const fill = card.querySelector('.progress-fill');
  const label = card.querySelector('.progress-label');
  const next = card.querySelector('.next-lesson-link');

  if (fill) fill.style.width = `${percent}%`;
  if (label) label.textContent = `${completed}/${cfg.total} lessons complete (${percent}%)`;
  if (next) next.href = cfg.next;
});

const markBtn = document.querySelector('[data-mark-complete]');
if (markBtn) {
  markBtn.addEventListener('click', () => {
    const track = markBtn.dataset.track;
    const cfg = progressConfig[track];
    if (!cfg) return;

    const updated = Math.min(cfg.total, getProgress(track) + 1);
    setProgress(track, updated);
    markBtn.textContent = 'Completed ✓';
    markBtn.disabled = true;

    const feedback = document.querySelector('[data-completion-feedback]');
    if (feedback) {
      feedback.textContent = `Great work! Progress updated: ${updated}/${cfg.total}.`;
    }
  });
}

document.querySelectorAll('[data-reveal-answers]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = document.querySelector(btn.dataset.target);
    if (!target) return;

    target.classList.add('revealed');
    btn.disabled = true;
    btn.textContent = 'Answers Revealed';
  });
});
