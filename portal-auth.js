const STORAGE_KEY = 'tih_students_v1';
const SESSION_KEY = 'tih_student_session_v1';
const ADMIN_SESSION_KEY = 'tih_admin_session_v1';
const ADMIN_USER = {
  email: 'admin@tolbertinnovationhub.org',
  password: 'Admin@12345',
  name: 'TIH Admissions Admin'
};

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getStudents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStudents(students) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function setFeedback(form, message, isError = false) {
  const feedback = form.querySelector('.form-feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.style.color = isError ? '#b42318' : '#0b5a32';
}

function getSessionStudent() {
  const sessionId = sessionStorage.getItem(SESSION_KEY);
  const students = getStudents();
  return students.find((s) => s.id === sessionId) || null;
}

function getAdminSession() {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.reportValidity();
    setFeedback(form, 'Please complete all required fields.', true);
    return;
  }

  const data = new FormData(form);
  const email = String(data.get('email')).trim().toLowerCase();
  const password = String(data.get('password'));
  const students = getStudents();

  if (students.some((s) => s.email === email)) {
    setFeedback(form, 'An account with this email already exists. Please log in.', true);
    return;
  }

  const passwordHash = await hashPassword(password);
  const student = {
    id: crypto.randomUUID(),
    fullName: String(data.get('fullName')).trim(),
    email,
    phone: String(data.get('phone')).trim(),
    program: String(data.get('program')).trim(),
    passwordHash,
    submissions: [],
    createdAt: new Date().toISOString()
  };

  students.push(student);
  saveStudents(students);
  sessionStorage.setItem(SESSION_KEY, student.id);
  window.location.href = 'portal-dashboard.html';
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.reportValidity();
    setFeedback(form, 'Please enter your email and password.', true);
    return;
  }

  const data = new FormData(form);
  const email = String(data.get('email')).trim().toLowerCase();
  const passwordHash = await hashPassword(String(data.get('password')));
  const students = getStudents();
  const student = students.find((s) => s.email === email && s.passwordHash === passwordHash);

  if (!student) {
    setFeedback(form, 'Invalid login credentials. Please try again.', true);
    return;
  }

  sessionStorage.setItem(SESSION_KEY, student.id);
  window.location.href = 'portal-dashboard.html';
}

function renderSubmissionHistory(student) {
  const host = document.getElementById('submission-history');
  if (!host) return;

  const submissions = student.submissions || [];
  if (!submissions.length) {
    host.innerHTML = '<p class="section-intro">No application submitted yet.</p>';
    return;
  }

  host.innerHTML = submissions
    .slice()
    .reverse()
    .map((submission) => {
      const documents = (submission.documents || [])
        .map((doc) => `<li>${escapeHTML(doc.name)} <small>(${escapeHTML(doc.type || 'unknown')}, ${escapeHTML(doc.sizeLabel)})</small></li>`)
        .join('');

      return `
        <article class="submission-item">
          <h4>${escapeHTML(submission.applicationType)}</h4>
          <p><strong>Status:</strong> <span class="badge">${escapeHTML(submission.status || 'Submitted')}</span></p>
          <p><strong>Target:</strong> ${escapeHTML(submission.targetProgram)}</p>
          <p><strong>Submitted:</strong> ${new Date(submission.submittedAt).toLocaleString()}</p>
          <p><strong>Summary:</strong> ${escapeHTML(submission.summary)}</p>
          <ul class="list-tight">${documents}</ul>
        </article>
      `;
    })
    .join('');
}

function renderStudentStatus(student) {
  const host = document.getElementById('application-status-list');
  if (!host) return;

  const submissions = student.submissions || [];
  if (!submissions.length) {
    host.innerHTML = [
      '<li>✅ Account created successfully</li>',
      '<li>📝 Start by submitting your first application below.</li>',
      '<li>📨 Admission letter updates will appear once approved.</li>'
    ].join('');
    return;
  }

  const latest = submissions[submissions.length - 1];
  host.innerHTML = [
    '<li>✅ Account created successfully</li>',
    `<li>📄 Latest application: ${escapeHTML(latest.applicationType)}</li>`,
    `<li>🕒 Review status: ${escapeHTML(latest.status || 'Submitted')}</li>`
  ].join('');
}

function renderAdmissionLetters(student) {
  const host = document.getElementById('admission-letter-history');
  if (!host) return;

  const letters = (student.submissions || [])
    .filter((submission) => submission.admissionLetter)
    .map((submission) => ({ ...submission.admissionLetter, applicationType: submission.applicationType, targetProgram: submission.targetProgram }))
    .reverse();

  if (!letters.length) {
    host.innerHTML = '<p class="section-intro">No admission letter has been issued yet.</p>';
    return;
  }

  host.innerHTML = letters
    .map(
      (letter) => `
      <article class="submission-item letter-item">
        <h4>Letter ID: ${escapeHTML(letter.letterId)}</h4>
        <p><strong>Program:</strong> ${escapeHTML(letter.applicationType)} – ${escapeHTML(letter.targetProgram)}</p>
        <p><strong>Issued On:</strong> ${new Date(letter.issuedAt).toLocaleString()}</p>
        <p><strong>Issued By:</strong> ${escapeHTML(letter.issuedBy)}</p>
        <p><strong>Letter Note:</strong> ${escapeHTML(letter.message)}</p>
      </article>
    `
    )
    .join('');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const CLASSROOM_STORAGE_KEY = 'tih_classroom_data_v1';
const COURSE_MODULES = {
  IELTS: [
    'Listening Basics', 'Academic Reading Skills', 'General Reading Strategies', 'Task 1 Writing',
    'Task 2 Writing', 'Speaking Part 1', 'Speaking Part 2', 'Speaking Part 3',
    'Vocabulary Builder', 'Grammar Essentials', 'Timed Mock Test', 'Score Review'
  ],
  TOEFL: [
    'Reading Foundations', 'Listening Foundations', 'Integrated Speaking', 'Independent Speaking',
    'Integrated Writing', 'Academic Discussion Writing', 'Vocabulary Sprint', 'Grammar Refresher',
    'Timed TOEFL Mock', 'Score Analysis'
  ]
};

function getClassroomStore() {
  try {
    return JSON.parse(localStorage.getItem(CLASSROOM_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveClassroomStore(store) {
  localStorage.setItem(CLASSROOM_STORAGE_KEY, JSON.stringify(store));
}

function getStudentClassroomData(studentId) {
  const store = getClassroomStore();
  const existing = store[studentId] || {};
  return {
    completedModules: Array.isArray(existing.completedModules) ? existing.completedModules : [],
    practiceScores: Array.isArray(existing.practiceScores) ? existing.practiceScores : [],
    writingSpeakingEntries: Array.isArray(existing.writingSpeakingEntries) ? existing.writingSpeakingEntries : [],
    lastActivity: existing.lastActivity || null
  };
}

function saveStudentClassroomData(studentId, data) {
  const store = getClassroomStore();
  store[studentId] = data;
  saveClassroomStore(store);
}

function getCourseProgress(courseName, completedModules) {
  const lessons = COURSE_MODULES[courseName].map((moduleName) => `${courseName}-${moduleName}`);
  const done = lessons.filter((id) => completedModules.includes(id)).length;
  const total = lessons.length;
  const percent = Math.round((done / total) * 100);
  const status = done === 0 ? 'Not Started' : done === total ? 'Completed' : 'In Progress';
  return { done, total, percent, status };
}

function renderCourseSummary(classroomData) {
  const ielts = getCourseProgress('IELTS', classroomData.completedModules);
  const toefl = getCourseProgress('TOEFL', classroomData.completedModules);

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('summary-ielts-progress', `${ielts.done}/${ielts.total} lessons (${ielts.percent}%) • ${ielts.status}`);
  setText('summary-toefl-progress', `${toefl.done}/${toefl.total} lessons (${toefl.percent}%) • ${toefl.status}`);
  setText('summary-last-activity', classroomData.lastActivity ? new Date(classroomData.lastActivity).toLocaleString() : 'No recent activity');
}

function renderModules(classroomData) {
  const host = document.getElementById('module-list');
  if (!host) return;

  const cards = Object.entries(COURSE_MODULES).flatMap(([courseName, modules]) =>
    modules.map((moduleName, index) => {
      const moduleId = `${courseName}-${moduleName}`;
      const slug = moduleId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const completed = classroomData.completedModules.includes(moduleId);
      const status = completed ? 'Completed' : 'Not Started';
      return `
        <article class="module-item" id="module-${slug}">
          <h4>${courseName} Lesson ${index + 1}: ${escapeHTML(moduleName)}</h4>
          <p><strong>Status:</strong> <span class="badge">${status}</span></p>
          <div class="module-actions">
            <a class="btn btn-outline-dark" href="portal-dashboard.html#module-${slug}">Open Module</a>
            <button type="button" class="btn btn-primary mark-module-btn" data-module-id="${escapeHTML(moduleId)}">
              ${completed ? 'Completed' : 'Mark Module Complete'}
            </button>
          </div>
        </article>
      `;
    })
  );

  host.innerHTML = cards.join('');
}

function updateContinueLearningLink(classroomData) {
  const link = document.getElementById('continue-learning-btn');
  if (!link) return;

  const firstIncomplete = Object.entries(COURSE_MODULES)
    .flatMap(([courseName, modules]) => modules.map((moduleName) => `${courseName}-${moduleName}`))
    .find((moduleId) => !classroomData.completedModules.includes(moduleId));

  if (!firstIncomplete) {
    link.textContent = 'All modules completed';
    link.href = 'portal-dashboard.html#module-list';
    return;
  }

  const slug = firstIncomplete.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  link.textContent = 'Continue Learning';
  link.href = `portal-dashboard.html#module-${slug}`;
}

function renderPracticePerformance(classroomData) {
  const scores = classroomData.practiceScores;
  const latest = scores[scores.length - 1];
  const best = scores.length ? Math.max(...scores.map((s) => s.score)) : null;

  const latestEl = document.getElementById('practice-latest-score');
  if (latestEl) latestEl.textContent = latest ? `${latest.score}% (${new Date(latest.date).toLocaleDateString()})` : 'No test submitted yet';

  const bestEl = document.getElementById('practice-best-score');
  if (bestEl) bestEl.textContent = best === null ? 'No test submitted yet' : `${best}%`;

  const attemptsEl = document.getElementById('practice-attempts');
  if (attemptsEl) attemptsEl.textContent = String(scores.length);
}

function renderWritingSpeakingHistory(classroomData) {
  const host = document.getElementById('writing-speaking-history');
  if (!host) return;

  if (!classroomData.writingSpeakingEntries.length) {
    host.innerHTML = '<p class="section-intro">No writing or speaking entries yet.</p>';
    return;
  }

  host.innerHTML = classroomData.writingSpeakingEntries
    .slice()
    .reverse()
    .map((entry) => `
      <article class="submission-item">
        <h4>${escapeHTML(entry.type)}: ${escapeHTML(entry.title)}</h4>
        <p><strong>Date:</strong> ${new Date(entry.date).toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="badge">${escapeHTML(entry.status)}</span></p>
      </article>
    `)
    .join('');
}

function bindClassroomActions(student, classroomData) {
  const moduleHost = document.getElementById('module-list');
  if (moduleHost) {
    moduleHost.addEventListener('click', (event) => {
      const button = event.target.closest('.mark-module-btn');
      if (!button) return;

      const moduleId = button.dataset.moduleId;
      if (!moduleId || classroomData.completedModules.includes(moduleId)) return;

      classroomData.completedModules.push(moduleId);
      classroomData.lastActivity = new Date().toISOString();
      saveStudentClassroomData(student.id, classroomData);
      renderModules(classroomData);
      renderCourseSummary(classroomData);
      updateContinueLearningLink(classroomData);
    });
  }

  const scoreForm = document.getElementById('practice-score-form');
  if (scoreForm) {
    scoreForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!scoreForm.checkValidity()) {
        scoreForm.reportValidity();
        setFeedback(scoreForm, 'Please enter a valid score between 0 and 100.', true);
        return;
      }

      const value = Number(new FormData(scoreForm).get('score'));
      classroomData.practiceScores.push({ score: value, date: new Date().toISOString() });
      classroomData.lastActivity = new Date().toISOString();
      saveStudentClassroomData(student.id, classroomData);
      renderPracticePerformance(classroomData);
      renderCourseSummary(classroomData);
      setFeedback(scoreForm, 'Practice score saved successfully.');
      scoreForm.reset();
    });
  }

  const wsForm = document.getElementById('writing-speaking-form');
  if (wsForm) {
    wsForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!wsForm.checkValidity()) {
        wsForm.reportValidity();
        setFeedback(wsForm, 'Please complete all writing/speaking fields.', true);
        return;
      }

      const formData = new FormData(wsForm);
      classroomData.writingSpeakingEntries.push({
        type: String(formData.get('type')).trim(),
        title: String(formData.get('title')).trim(),
        status: String(formData.get('status')).trim(),
        date: new Date().toISOString()
      });
      classroomData.lastActivity = new Date().toISOString();
      saveStudentClassroomData(student.id, classroomData);
      renderWritingSpeakingHistory(classroomData);
      renderCourseSummary(classroomData);
      setFeedback(wsForm, 'Entry added to tracker.');
      wsForm.reset();
    });
  }
}

function handleApplicationSubmission(event) {
  event.preventDefault();
  const form = event.currentTarget;

  if (!form.checkValidity()) {
    form.reportValidity();
    setFeedback(form, 'Please complete all fields and upload at least one document.', true);
    return;
  }

  const current = getSessionStudent();
  if (!current) {
    window.location.href = 'portal-login.html';
    return;
  }

  const fileInput = document.getElementById('supporting-documents');
  const files = Array.from(fileInput?.files || []);
  if (!files.length) {
    setFeedback(form, 'Please upload at least one supporting document.', true);
    return;
  }

  const data = new FormData(form);
  const submission = {
    id: crypto.randomUUID(),
    applicationType: String(data.get('applicationType')).trim(),
    targetProgram: String(data.get('targetProgram')).trim(),
    summary: String(data.get('summary')).trim(),
    documents: files.map((f) => ({
      name: f.name,
      size: f.size,
      sizeLabel: formatSize(f.size),
      type: f.type || 'file'
    })),
    submittedAt: new Date().toISOString(),
    status: 'Submitted'
  };

  const students = getStudents();
  const index = students.findIndex((s) => s.id === current.id);
  if (index === -1) {
    window.location.href = 'portal-login.html';
    return;
  }

  students[index].submissions = students[index].submissions || [];
  students[index].submissions.push(submission);
  saveStudents(students);

  setFeedback(form, 'Application submitted successfully with your uploaded documents.');
  form.reset();
  renderSubmissionHistory(students[index]);
  renderStudentStatus(students[index]);
  renderAdmissionLetters(students[index]);
}

function loadDashboard() {
  const student = getSessionStudent();
  const logoutBtn = document.getElementById('logout-btn');
  const loginBtn = document.getElementById('login-btn');
  const loginState = document.getElementById('login-state-text');

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '-';
  };

  if (!student) {
    if (logoutBtn) logoutBtn.hidden = true;
    if (loginBtn) loginBtn.hidden = false;
    if (loginState) loginState.innerHTML = '<strong>Session:</strong> Not logged in';
    setText('student-name', 'Student');
    setText('student-email', '-');
    setText('student-phone', '-');
    setText('student-program', '-');
    return;
  }

  if (logoutBtn) logoutBtn.hidden = false;
  if (loginBtn) loginBtn.hidden = true;
  if (loginState) loginState.innerHTML = '<strong>Session:</strong> Logged in';

  setText('student-name', student.fullName);
  setText('student-email', student.email);
  setText('student-phone', student.phone);
  setText('student-program', student.program);

  renderSubmissionHistory(student);
  renderStudentStatus(student);
  renderAdmissionLetters(student);

  const classroomData = getStudentClassroomData(student.id);
  renderCourseSummary(classroomData);
  renderModules(classroomData);
  updateContinueLearningLink(classroomData);
  renderPracticePerformance(classroomData);
  renderWritingSpeakingHistory(classroomData);
  bindClassroomActions(student, classroomData);

  const applicationForm = document.getElementById('application-submission-form');
  if (applicationForm) {
    applicationForm.addEventListener('submit', handleApplicationSubmission);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = 'portal-login.html';
    });
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.reportValidity();
    setFeedback(form, 'Please enter admin email and password.', true);
    return;
  }

  const data = new FormData(form);
  const email = String(data.get('email')).trim().toLowerCase();
  const password = String(data.get('password'));

  if (email !== ADMIN_USER.email || password !== ADMIN_USER.password) {
    setFeedback(form, 'Invalid admin credentials.', true);
    return;
  }

  sessionStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({ email: ADMIN_USER.email, name: ADMIN_USER.name, loggedInAt: new Date().toISOString() })
  );
  window.location.href = 'admin-dashboard.html';
}

function findSubmission(students, studentId, submissionId) {
  const studentIndex = students.findIndex((student) => student.id === studentId);
  if (studentIndex === -1) return null;

  const submissionIndex = (students[studentIndex].submissions || []).findIndex((submission) => submission.id === submissionId);
  if (submissionIndex === -1) return null;

  return {
    studentIndex,
    submissionIndex,
    student: students[studentIndex],
    submission: students[studentIndex].submissions[submissionIndex]
  };
}

function getAllSubmissions(students) {
  return students.flatMap((student) =>
    (student.submissions || []).map((submission) => ({
      studentId: student.id,
      studentName: student.fullName,
      studentEmail: student.email,
      studentProgram: student.program,
      ...submission
    }))
  );
}

function renderAdminSummary(students) {
  const totalStudents = students.length;
  const totalSubmissions = students.reduce((count, student) => count + (student.submissions || []).length, 0);
  const issuedLetters = students.reduce(
    (count, student) => count + (student.submissions || []).filter((submission) => submission.admissionLetter).length,
    0
  );

  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  setValue('total-students', totalStudents);
  setValue('total-submissions', totalSubmissions);
  setValue('issued-letters', issuedLetters);
}

function renderAdminSubmissions() {
  const host = document.getElementById('admin-submissions');
  const students = getStudents();
  if (!host) return;

  renderAdminSummary(students);
  const allSubmissions = getAllSubmissions(students);

  if (!allSubmissions.length) {
    host.innerHTML = '<p class="section-intro">No student submissions available yet.</p>';
    return;
  }

  host.innerHTML = allSubmissions
    .slice()
    .reverse()
    .map((submission) => {
      const docs = (submission.documents || [])
        .map((doc) => `<li>${escapeHTML(doc.name)} <small>(${escapeHTML(doc.sizeLabel)})</small></li>`)
        .join('');

      const letter = submission.admissionLetter
        ? `<div class="letter-box"><strong>Issued Letter:</strong> ${escapeHTML(submission.admissionLetter.letterId)} on ${new Date(submission.admissionLetter.issuedAt).toLocaleString()}</div>`
        : '';

      return `
      <article class="card admin-submission-item" data-student-id="${escapeHTML(submission.studentId)}" data-submission-id="${escapeHTML(submission.id)}">
        <h3>${escapeHTML(submission.applicationType)}</h3>
        <p><strong>Student:</strong> ${escapeHTML(submission.studentName)} (${escapeHTML(submission.studentEmail)})</p>
        <p><strong>Student Track:</strong> ${escapeHTML(submission.studentProgram)}</p>
        <p><strong>Target Program:</strong> ${escapeHTML(submission.targetProgram)}</p>
        <p><strong>Submitted:</strong> ${new Date(submission.submittedAt).toLocaleString()}</p>
        <p><strong>Summary:</strong> ${escapeHTML(submission.summary)}</p>
        <ul class="list-tight">${docs}</ul>

        <div class="admin-actions">
          <label>Review Status
            <select class="admin-status-select">
              <option ${submission.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
              <option ${submission.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
              <option ${submission.status === 'Needs More Documents' ? 'selected' : ''}>Needs More Documents</option>
              <option ${submission.status === 'Qualified' ? 'selected' : ''}>Qualified</option>
              <option ${submission.status === 'Admission Letter Issued' ? 'selected' : ''}>Admission Letter Issued</option>
            </select>
          </label>
          <button type="button" class="btn btn-primary btn-save-status">Save Status</button>
        </div>

        <form class="admin-letter-form form-wrap">
          <label>Admission Letter Message
            <textarea name="letterMessage" rows="3" required placeholder="Enter admission letter note for the student."></textarea>
          </label>
          <button type="submit" class="btn btn-primary">Issue Admission Letter</button>
          <p class="form-feedback" aria-live="polite"></p>
        </form>
        ${letter}
      </article>
      `;
    })
    .join('');
}

function loadAdminDashboard() {
  const session = getAdminSession();
  if (!session?.email) {
    window.location.href = 'admin-login.html';
    return;
  }

  const nameEl = document.getElementById('admin-name');
  if (nameEl) nameEl.textContent = session.name;

  renderAdminSubmissions();

  const host = document.getElementById('admin-submissions');
  if (host) {
    host.addEventListener('click', (event) => {
      const button = event.target.closest('.btn-save-status');
      if (!button) return;

      const container = button.closest('.admin-submission-item');
      if (!container) return;

      const studentId = container.dataset.studentId;
      const submissionId = container.dataset.submissionId;
      const statusSelect = container.querySelector('.admin-status-select');
      const selectedStatus = statusSelect ? statusSelect.value : 'Submitted';

      const students = getStudents();
      const match = findSubmission(students, studentId, submissionId);
      if (!match) return;

      students[match.studentIndex].submissions[match.submissionIndex].status = selectedStatus;
      saveStudents(students);
      renderAdminSubmissions();
    });

    host.addEventListener('submit', (event) => {
      const form = event.target.closest('.admin-letter-form');
      if (!form) return;
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        setFeedback(form, 'Please include a letter message before issuing.', true);
        return;
      }

      const container = form.closest('.admin-submission-item');
      if (!container) return;

      const studentId = container.dataset.studentId;
      const submissionId = container.dataset.submissionId;
      const message = String(new FormData(form).get('letterMessage')).trim();
      const students = getStudents();
      const match = findSubmission(students, studentId, submissionId);

      if (!match) {
        setFeedback(form, 'Unable to find submission. Please refresh.', true);
        return;
      }

      const letterId = `TIH-ADMIT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      students[match.studentIndex].submissions[match.submissionIndex].status = 'Admission Letter Issued';
      students[match.studentIndex].submissions[match.submissionIndex].admissionLetter = {
        letterId,
        message,
        issuedAt: new Date().toISOString(),
        issuedBy: session.name
      };

      saveStudents(students);
      renderAdminSubmissions();
    });
  }

  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      window.location.href = 'admin-login.html';
    });
  }
}

const registerForm = document.getElementById('student-register-form');
if (registerForm) registerForm.addEventListener('submit', handleRegister);

const loginForm = document.getElementById('student-login-form');
if (loginForm) loginForm.addEventListener('submit', handleLogin);

const adminLoginForm = document.getElementById('admin-login-form');
if (adminLoginForm) adminLoginForm.addEventListener('submit', handleAdminLogin);

if (document.getElementById('student-name')) loadDashboard();
if (document.getElementById('admin-name')) loadAdminDashboard();
