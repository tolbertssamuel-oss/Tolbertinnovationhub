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
  const durationMins = Number(display.dataset.durationMinutes || 30);
  const initialSeconds = Math.max(60, durationMins * 60);
  const timerStorageKey = `classroom_practice_timer_${window.location.pathname.split('/').pop() || 'default'}`;
  const persistedSeconds = Number(localStorage.getItem(timerStorageKey));

  let remaining = Number.isFinite(persistedSeconds) && persistedSeconds > 0 ? persistedSeconds : initialSeconds;
  let timerId = null;

  const render = () => {
    const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
    const ss = String(remaining % 60).padStart(2, '0');
    display.textContent = `${mm}:${ss}`;
  };

  const persist = () => localStorage.setItem(timerStorageKey, String(remaining));

  startBtn.addEventListener('click', () => {
    if (timerId) return;
    timerId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        remaining = 0;
        clearInterval(timerId);
        timerId = null;
      }
      persist();
      render();
    }, 1000);
  });

  pauseBtn?.addEventListener('click', () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    persist();
  });

  resetBtn?.addEventListener('click', () => {
    clearInterval(timerId);
    timerId = null;
    remaining = initialSeconds;
    persist();
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
      let answered = 0;

      fields.forEach((field) => {
        const attempt = String(field.value || '').trim().toLowerCase();
        const solution = String(field.dataset.correct || '').trim().toLowerCase();
        if (attempt) answered += 1;
        if (attempt && attempt === solution) correct += 1;
      });

      const total = fields.length;
      const percent = total ? Math.round((correct / total) * 100) : 0;
      setJSON(`classroom_${scoreType}_score`, { correct, total, answered, percent, at: new Date().toISOString() });
      const feedback = document.querySelector(`#${scoreType}-score-feedback`);
      if (feedback) {
        feedback.textContent = `${scoreType.toUpperCase()} score: ${correct}/${total} (${percent}%). Answered ${answered}/${total}. Saved to dashboard.`;
      }
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


function renderSkillCardProgress() {
  const reading = getJSON('classroom_reading_score', null);
  const listening = getJSON('classroom_listening_score', null);
  const writingCount = Number(localStorage.getItem('classroom_writing_submissions') || 0);
  const speakingCount = Number(localStorage.getItem('classroom_speaking_recordings') || 0);

  const progressBySkill = {
    reading: reading?.percent || 0,
    listening: listening?.percent || 0,
    writing: Math.min(100, writingCount * 20),
    speaking: Math.min(100, speakingCount * 20)
  };

  Object.entries(progressBySkill).forEach(([skill, percent]) => {
    const fill = document.querySelector(`[data-skill-progress-fill="${skill}"]`);
    const label = document.querySelector(`[data-skill-progress-label="${skill}"]`);
    if (fill) fill.style.width = `${percent}%`;
    if (label) label.textContent = `Progress: ${percent}%`;
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


function wireLevelFilters() {
  document.querySelectorAll('[data-level-controls]').forEach((controlRow) => {
    const groupName = controlRow.dataset.levelControls;
    const buttons = controlRow.querySelectorAll('[data-level]');
    const groups = document.querySelectorAll(`[data-level-group="${groupName}"]`);
    if (!buttons.length || !groups.length) return;

    const setLevel = (level) => {
      buttons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.level === level));
      groups.forEach((group) => group.classList.toggle('is-active', group.dataset.level === level));
    };

    const activeBtn = controlRow.querySelector('.level-pill.is-active') || buttons[0];
    setLevel(activeBtn.dataset.level);

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => setLevel(btn.dataset.level));
    });
  });
}



function getIELTSModuleState(moduleId) {
  return {
    completed: localStorage.getItem(`ielts_module_${moduleId}_complete`) === 'true',
    quizPassed: localStorage.getItem(`ielts_module_${moduleId}_quiz_pass`) === 'true'
  };
}

function isIELTSModuleUnlocked(moduleId) {
  if (moduleId <= 1) return true;
  return localStorage.getItem(`ielts_module_${moduleId - 1}_complete`) === 'true';
}

function renderIELTSDashboard() {
  const cards = document.querySelectorAll('[data-ielts-module-card]');
  if (!cards.length) return;

  let completedCount = 0;

  cards.forEach((card) => {
    const moduleId = Number(card.dataset.ieltsModuleCard);
    const statusEl = card.querySelector(`[data-ielts-status="${moduleId}"]`);
    const openLink = card.querySelector(`[data-ielts-open="${moduleId}"]`);
    const { completed } = getIELTSModuleState(moduleId);
    const unlocked = isIELTSModuleUnlocked(moduleId);

    if (completed) completedCount += 1;

    if (statusEl) {
      if (completed) statusEl.textContent = 'Status: Completed';
      else if (unlocked) statusEl.textContent = 'Status: In Progress';
      else statusEl.textContent = 'Status: Locked';
    }

    if (openLink) {
      const locked = !completed && !unlocked;
      openLink.classList.toggle('btn-disabled', locked);
      openLink.setAttribute('aria-disabled', String(locked));
      if (locked) openLink.setAttribute('tabindex', '-1');
      else openLink.removeAttribute('tabindex');
    }
  });

  const fill = document.querySelector('#ielts-course-progress-fill');
  const label = document.querySelector('#ielts-course-progress-label');
  const percent = Math.round((completedCount / 6) * 100);
  if (fill) fill.style.width = `${percent}%`;
  if (label) label.textContent = `${completedCount} of 6 modules completed (${percent}%)`;
}

function wireIELTSModulePage() {
  const page = document.querySelector('[data-ielts-module-page]');
  if (!page) return;

  const moduleId = Number(page.dataset.moduleId || 1);
  const unlocked = isIELTSModuleUnlocked(moduleId);
  const nextModuleLink = document.querySelector('[data-next-module]');
  const feedback = document.querySelector('[data-module-feedback]');
  const quizFeedback = document.querySelector('[data-quiz-feedback]');

  if (!unlocked) {
    if (feedback) feedback.textContent = 'This module is locked. Complete the previous module first.';
    document.querySelectorAll('input, button, textarea, select').forEach((el) => {
      if (!el.hasAttribute('data-allow-locked')) el.disabled = true;
    });
    return;
  }

  const moduleState = getIELTSModuleState(moduleId);
  const updateNextLink = () => {
    if (!nextModuleLink) return;
    const isComplete = localStorage.getItem(`ielts_module_${moduleId}_complete`) === 'true';
    const shouldDisable = !isComplete && moduleId < 6;
    nextModuleLink.classList.toggle('btn-disabled', shouldDisable);
    nextModuleLink.setAttribute('aria-disabled', String(shouldDisable));
    if (shouldDisable) nextModuleLink.setAttribute('tabindex', '-1');
    else nextModuleLink.removeAttribute('tabindex');
  };

  const checklistItems = Array.from(document.querySelectorAll('[data-complete-item]'));
  const checklistFill = document.querySelector('[data-check-progress-fill]');
  const checklistLabel = document.querySelector('[data-check-progress-label]');
  const updateChecklistProgress = () => {
    if (!checklistItems.length) return;
    const checked = checklistItems.filter((item) => item.checked).length;
    const percent = Math.round((checked / checklistItems.length) * 100);
    if (checklistFill) checklistFill.style.width = `${percent}%`;
    if (checklistLabel) checklistLabel.textContent = `Lesson completion checklist: ${percent}%`;
  };
  checklistItems.forEach((item) => item.addEventListener('change', updateChecklistProgress));

  const quizForm = document.querySelector('[data-ielts-quiz]');
  const quizExplanationBox = document.querySelector('[data-quiz-explanations]');
  quizForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const groups = Array.from(quizForm.querySelectorAll('.quiz-item'));
    let correct = 0;
    groups.forEach((group) => {
      const checked = group.querySelector('input[type="radio"]:checked');
      if (checked?.dataset.correct === 'true') correct += 1;
    });
    const total = groups.length;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    const passed = percent >= 70;
    localStorage.setItem(`ielts_module_${moduleId}_quiz_pass`, String(passed));
    if (quizFeedback) quizFeedback.textContent = `Quiz result: ${correct}/${total} (${percent}%). ${passed ? 'Passed.' : 'Please review and retry.'}`;

    if (quizExplanationBox) {
      const explanations = groups.map((g, i) => `<li><strong>Q${i + 1}:</strong> ${g.dataset.explanation || 'Review this concept in the notes.'}</li>`).join('');
      quizExplanationBox.innerHTML = `<h3>Answer Explanations</h3><ul class="resource-list">${explanations}</ul>`;
    }
  });

  const reflectionText = document.querySelector('#module-reflection-text');
  const reflectionSave = document.querySelector('#module-reflection-save');
  const reflectionFeedback = document.querySelector('#module-reflection-feedback');
  const reflectionKey = `ielts_module_${moduleId}_reflection`;
  if (reflectionText) reflectionText.value = localStorage.getItem(reflectionKey) || '';
  reflectionSave?.addEventListener('click', () => {
    if (!reflectionText) return;
    localStorage.setItem(reflectionKey, reflectionText.value.trim());
    if (reflectionFeedback) reflectionFeedback.textContent = 'Reflection saved successfully.';
  });

  const markBtn = document.querySelector('[data-mark-module-complete]');
  markBtn?.addEventListener('click', () => {
    const allChecked = checklistItems.length > 0 && checklistItems.every((item) => item.checked);
    const quizPassed = localStorage.getItem(`ielts_module_${moduleId}_quiz_pass`) === 'true';

    if (!allChecked) {
      if (feedback) feedback.textContent = 'Complete all assignment checklist items before marking complete.';
      return;
    }

    if (!quizPassed) {
      if (feedback) feedback.textContent = 'Pass the mini quiz (70%+) before marking this module complete.';
      return;
    }

    localStorage.setItem(`ielts_module_${moduleId}_complete`, 'true');
    if (feedback) feedback.textContent = `Module ${moduleId} marked complete. Next module unlocked.`;
    if (markBtn) markBtn.textContent = 'Completed ✓';
    updateNextLink();
  });

  if (moduleState.completed && feedback) {
    feedback.textContent = `Module ${moduleId} already completed. You can continue to the next module.`;
    const markBtnNow = document.querySelector('[data-mark-module-complete]');
    if (markBtnNow) markBtnNow.textContent = 'Completed ✓';
  }
  updateChecklistProgress();
  updateNextLink();
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
renderSkillCardProgress();
wireLevelFilters();
renderIELTSDashboard();
wireIELTSModulePage();
