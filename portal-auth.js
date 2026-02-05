const STORAGE_KEY = 'tih_students_v1';
const SESSION_KEY = 'tih_student_session_v1';

function getStudents() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveStudents(students) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
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
        .map((doc) => `<li>${doc.name} <small>(${doc.type || 'unknown'}, ${doc.sizeLabel})</small></li>`)
        .join('');

      return `
        <article class="submission-item">
          <h4>${submission.applicationType}</h4>
          <p><strong>Target:</strong> ${submission.targetProgram}</p>
          <p><strong>Submitted:</strong> ${new Date(submission.submittedAt).toLocaleString()}</p>
          <p><strong>Summary:</strong> ${submission.summary}</p>
          <ul class="list-tight">${documents}</ul>
        </article>
      `;
    })
    .join('');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
}

function loadDashboard() {
  const student = getSessionStudent();

  if (!student) {
    window.location.href = 'portal-login.html';
    return;
  }

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '-';
  };

  setText('student-name', student.fullName);
  setText('student-email', student.email);
  setText('student-phone', student.phone);
  setText('student-program', student.program);

  renderSubmissionHistory(student);

  const applicationForm = document.getElementById('application-submission-form');
  if (applicationForm) {
    applicationForm.addEventListener('submit', handleApplicationSubmission);
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = 'portal-login.html';
    });
  }
}

const registerForm = document.getElementById('student-register-form');
if (registerForm) registerForm.addEventListener('submit', handleRegister);

const loginForm = document.getElementById('student-login-form');
if (loginForm) loginForm.addEventListener('submit', handleLogin);

if (document.getElementById('student-name')) loadDashboard();
