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

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `tih-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

async function hashPassword(password) {
  const value = String(password ?? '');

  if (window.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return `fallback-${Math.abs(hash)}`;
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

  try {
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
      id: createId(),
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
  } catch (error) {
    console.error('Registration failed:', error);
    setFeedback(form, 'Unable to create your account right now. Please try again.', true);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.reportValidity();
    setFeedback(form, 'Please enter your email and password.', true);
    return;
  }

  try {
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
  } catch (error) {
    console.error('Login failed:', error);
    setFeedback(form, 'Unable to log in right now. Please try again.', true);
  }
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
    id: createId(),
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
  renderStudentStatus(student);
  renderAdmissionLetters(student);

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
