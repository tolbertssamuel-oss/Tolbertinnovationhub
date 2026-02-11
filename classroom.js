const navWrap = document.querySelector('.nav-wrap');
const navLinks = navWrap?.querySelector('.nav-links');

if (navWrap && navLinks) {
  if (!navLinks.id) navLinks.id = 'classroom-navigation';

  const optionalLinks = [
    { href: 'classroom-mastery-plan.html', label: 'Mastery Plan' },
    { href: 'classroom-login.html', label: 'Login' }
  ];

  optionalLinks.forEach(({ href, label }) => {
    if (!navLinks.querySelector(`a[href="${href}"]`)) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      if (window.location.pathname.endsWith(href)) link.classList.add('active');
      navLinks.append(link);
    }
  });

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

const getJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const setJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

function renderDashboardProgress() {
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
}

function wireLessonCompletion() {
  const markBtn = document.querySelector('[data-mark-complete]');
  if (!markBtn) return;

  markBtn.addEventListener('click', () => {
    const track = markBtn.dataset.track;
    const cfg = progressConfig[track];
    if (!cfg) return;

    const updated = Math.min(cfg.total, getProgress(track) + 1);
    setProgress(track, updated);
    markBtn.textContent = 'Completed ✓';
    markBtn.disabled = true;

    const feedback = document.querySelector('[data-completion-feedback]');
    if (feedback) feedback.textContent = `Great work! Progress updated: ${updated}/${cfg.total}.`;
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

function wireStudentLogin() {
  const registerForm = document.querySelector('#student-register-form');
  const loginForm = document.querySelector('#student-login-form');
  const registerFeedback = document.querySelector('#register-feedback');
  const loginFeedback = document.querySelector('#login-feedback');

  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(registerForm);
      const account = {
        name: String(fd.get('name') || '').trim(),
        email: String(fd.get('email') || '').trim().toLowerCase(),
        password: String(fd.get('password') || '')
      };
      if (!account.name || !account.email || account.password.length < 6) return;
      setJSON('classroom_student_account', account);
      setJSON('classroom_student_session', { name: account.name, email: account.email });
      if (registerFeedback) registerFeedback.textContent = 'Account created and logged in. Redirecting to dashboard...';
      setTimeout(() => { window.location.href = 'classroom-dashboard.html'; }, 700);
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(loginForm);
      const email = String(fd.get('email') || '').trim().toLowerCase();
      const password = String(fd.get('password') || '');
      const account = getJSON('classroom_student_account', null);
      if (!account || account.email !== email || account.password !== password) {
        if (loginFeedback) loginFeedback.textContent = 'Invalid login credentials. Use registered account details.';
        return;
      }
      setJSON('classroom_student_session', { name: account.name, email: account.email });
      if (loginFeedback) loginFeedback.textContent = 'Login successful. Redirecting to dashboard...';
      setTimeout(() => { window.location.href = 'classroom-dashboard.html'; }, 700);
    });
  }

  const status = document.querySelector('#student-session-status');
  const logoutBtn = document.querySelector('#student-logout-btn');
  const session = getJSON('classroom_student_session', null);
  if (status) {
    status.textContent = session ? `Logged in as ${session.name} (${session.email})` : 'Not logged in. Login to sync your classroom activity in this browser.';
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('classroom_student_session');
      window.location.href = 'classroom-login.html';
    });
  }
}

function wirePracticeTimer() {
  const display = document.querySelector('#practice-timer-display');
  const startBtn = document.querySelector('#practice-timer-start');
  if (!display || !startBtn) return;

  const pauseBtn = document.querySelector('#practice-timer-pause');
  const resetBtn = document.querySelector('#practice-timer-reset');
  let remaining = 30 * 60;
  let timerId = null;

  const render = () => {
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    display.textContent = `${mm}:${ss}`;
  };

  startBtn.addEventListener('click', () => {
    if (timerId) return;
    timerId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        remaining = 0;
        clearInterval(timerId);
        timerId = null;
      }
      render();
    }, 1000);
  });

  pauseBtn?.addEventListener('click', () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  });

  resetBtn?.addEventListener('click', () => {
    clearInterval(timerId);
    timerId = null;
    remaining = 30 * 60;
    render();
  });

  render();
}

function wireAutoScoring() {
  document.querySelectorAll('form[data-score-type]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const scoreType = form.dataset.scoreType;
      const fields = Array.from(form.querySelectorAll('[data-correct]'));
      let correct = 0;
      fields.forEach((field) => {
        if (String(field.value).trim() === field.dataset.correct) correct += 1;
      });
      const total = fields.length;
      const percent = Math.round((correct / total) * 100);
      setJSON(`classroom_${scoreType}_score`, { correct, total, percent, at: new Date().toISOString() });
      const feedback = document.querySelector(`#${scoreType}-score-feedback`);
      if (feedback) feedback.textContent = `${scoreType.toUpperCase()} score: ${correct}/${total} (${percent}%). Saved to dashboard.`;
    });
  });
}

function wireWritingSubmission() {
  const form = document.querySelector('#writing-feedback-form');
  if (!form) return;
  const feedback = document.querySelector('#writing-feedback-status');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const count = Number(localStorage.getItem('classroom_writing_submissions') || 0) + 1;
    localStorage.setItem('classroom_writing_submissions', String(count));
    if (feedback) feedback.textContent = `Submission received. Total writing submissions: ${count}.`;
    form.reset();
  });
}

function wireSpeakingRecording() {
  const startBtn = document.querySelector('#record-start-btn');
  if (!startBtn || !navigator.mediaDevices) return;

  const stopBtn = document.querySelector('#record-stop-btn');
  const status = document.querySelector('#recording-status');
  const playback = document.querySelector('#recording-playback');
  const dl = document.querySelector('#recording-download');
  const uploadInput = document.querySelector('#speaking-upload-input');
  const uploadStatus = document.querySelector('#speaking-upload-status');

  let recorder;
  let chunks = [];

  startBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      chunks = [];
      recorder.ondataavailable = (evt) => chunks.push(evt.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        if (playback) playback.src = url;
        if (dl) {
          dl.href = url;
          dl.style.display = 'inline-flex';
        }
        const count = Number(localStorage.getItem('classroom_speaking_recordings') || 0) + 1;
        localStorage.setItem('classroom_speaking_recordings', String(count));
        if (status) status.textContent = `Recording saved. Total recordings: ${count}.`;
      };
      recorder.start();
      startBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
      if (status) status.textContent = 'Recording... speak clearly and stop when done.';
    } catch {
      if (status) status.textContent = 'Microphone access denied or unavailable.';
    }
  });

  stopBtn?.addEventListener('click', () => {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
  });

  uploadInput?.addEventListener('change', () => {
    if (!uploadInput.files || uploadInput.files.length === 0) return;
    const count = Number(localStorage.getItem('classroom_speaking_recordings') || 0) + 1;
    localStorage.setItem('classroom_speaking_recordings', String(count));
    if (uploadStatus) uploadStatus.textContent = `Upload received (${uploadInput.files[0].name}). Total recordings: ${count}.`;
  });
}

function renderDashboardMetrics() {
  const reading = getJSON('classroom_reading_score', null);
  const listening = getJSON('classroom_listening_score', null);
  const writingCount = Number(localStorage.getItem('classroom_writing_submissions') || 0);
  const speakingCount = Number(localStorage.getItem('classroom_speaking_recordings') || 0);

  const readingEl = document.querySelector('#reading-score-status');
  const listeningEl = document.querySelector('#listening-score-status');
  const writingEl = document.querySelector('#writing-submission-status');
  const speakingEl = document.querySelector('#speaking-recording-status');

  if (readingEl && reading) readingEl.textContent = `Reading: ${reading.correct}/${reading.total} (${reading.percent}%)`;
  if (listeningEl && listening) listeningEl.textContent = `Listening: ${listening.correct}/${listening.total} (${listening.percent}%)`;
  if (writingEl) writingEl.textContent = `Writing submissions: ${writingCount}`;
  if (speakingEl) speakingEl.textContent = `Speaking recordings: ${speakingCount}`;
}

renderDashboardProgress();
wireLessonCompletion();
wireAnswerReveal();
wireStudentLogin();
wirePracticeTimer();
wireAutoScoring();
wireWritingSubmission();
wireSpeakingRecording();
renderDashboardMetrics();
