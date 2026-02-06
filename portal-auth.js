const STORAGE_KEY = 'tih_students_v1';
const SESSION_KEY = 'tih_student_session_v1';
const ADMIN_SESSION_KEY = 'tih_admin_session_v1';
const API_HEALTH = '/api/health';
const ADMIN_USER = {
  email: 'admin@tolbertinnovationhub.org',
  password: 'Admin@12345',
  name: 'TIH Admissions Admin'
};

let backendAvailable = null;

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `tih-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function getStudentsLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveStudentsLocal(students) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
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

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }
  return payload;
}

async function hasBackend() {
  if (backendAvailable !== null) return backendAvailable;
  try {
    await apiRequest(API_HEALTH, { method: 'GET' });
    backendAvailable = true;
  } catch {
    backendAvailable = false;
  }
  return backendAvailable;
}

function getAdminSession() {
  try {
    return JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

async function getSessionStudent() {
  const sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) return null;

  if (await hasBackend()) {
    try {
      const result = await apiRequest(`/api/students/${encodeURIComponent(sessionId)}`, { method: 'GET' });
      return result.student || null;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  const students = getStudentsLocal();
  return students.find((s) => s.id === sessionId) || null;
}

async function registerStudent(studentInput) {
  if (await hasBackend()) {
    const result = await apiRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify(studentInput)
    });
    return result.student;
  }

  const students = getStudentsLocal();
  if (students.some((s) => s.email === studentInput.email)) {
    throw new Error('An account with this email already exists. Please log in.');
  }

  const student = {
    id: createId(),
    ...studentInput,
    submissions: [],
    createdAt: new Date().toISOString()
  };
  students.push(student);
  saveStudentsLocal(students);
  const { passwordHash, ...safeStudent } = student;
  return safeStudent;
}

async function loginStudent(email, passwordHash) {
  if (await hasBackend()) {
    const result = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, passwordHash })
    });
    return result.student;
  }

  const students = getStudentsLocal();
  const student = students.find((s) => s.email === email && s.passwordHash === passwordHash);
  if (!student) throw new Error('Invalid login credentials. Please try again.');
  const { passwordHash: omit, ...safeStudent } = student;
  return safeStudent;
}

async function submitApplication(studentId, payload) {
  if (await hasBackend()) {
    const result = await apiRequest(`/api/students/${encodeURIComponent(studentId)}/submissions`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return result.student;
  }

  const students = getStudentsLocal();
  const index = students.findIndex((s) => s.id === studentId);
  if (index === -1) throw new Error('Student account not found. Please sign in again.');

  students[index].submissions = students[index].submissions || [];
  students[index].submissions.push({
    id: createId(),
    ...payload,
    submittedAt: new Date().toISOString(),
    status: 'Submitted'
  });
  saveStudentsLocal(students);
  const { passwordHash, ...safeStudent } = students[index];
  return safeStudent;
}

async function getAdminSubmissions() {
  if (await hasBackend()) {
    const result = await apiRequest('/api/admin/submissions', { method: 'GET' });
    return result.submissions || [];
  }

  return getStudentsLocal().flatMap((student) =>
    (student.submissions || []).map((submission) => ({
      studentId: student.id,
      studentName: student.fullName,
      studentEmail: student.email,
      studentProgram: student.program,
      ...submission
    }))
  );
}

async function getAdminSummary() {
  if (await hasBackend()) {
    return apiRequest('/api/admin/summary', { method: 'GET' });
  }

  const students = getStudentsLocal();
  return {
    totalStudents: students.length,
    totalSubmissions: students.reduce((count, s) => count + (s.submissions || []).length, 0),
    issuedLetters: students.reduce((count, s) => count + (s.submissions || []).filter((x) => x.admissionLetter).length, 0)
  };
}

async function updateSubmissionStatus(studentId, submissionId, status) {
  if (await hasBackend()) {
    await apiRequest(`/api/admin/submissions/${encodeURIComponent(studentId)}/${encodeURIComponent(submissionId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return;
  }

  const students = getStudentsLocal();
  const student = students.find((s) => s.id === studentId);
  const submission = student?.submissions?.find((x) => x.id === submissionId);
  if (!submission) throw new Error('Unable to find submission. Please refresh.');
  submission.status = status;
  saveStudentsLocal(students);
}

async function issueAdmissionLetter(studentId, submissionId, message, issuedBy) {
  if (await hasBackend()) {
    await apiRequest(`/api/admin/submissions/${encodeURIComponent(studentId)}/${encodeURIComponent(submissionId)}/letter`, {
      method: 'POST',
      body: JSON.stringify({ message, issuedBy })
    });
    return;
  }

  const students = getStudentsLocal();
  const student = students.find((s) => s.id === studentId);
  const submission = student?.submissions?.find((x) => x.id === submissionId);
  if (!submission) throw new Error('Unable to find submission. Please refresh.');
  submission.status = 'Admission Letter Issued';
  submission.admissionLetter = {
    letterId: `TIH-ADMIT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    message,
    issuedAt: new Date().toISOString(),
    issuedBy
  };
  saveStudentsLocal(students);
}

function renderSubmissionHistory(student) {
  const host = document.getElementById('submission-history');
  if (!host) return;

  const submissions = student.submissions || [];
  if (!submissions.length) {
    host.innerHTML = '<p class="section-intro">No application submitted yet.</p>';
    return;
  }

  host.innerHTML = submissions.slice().reverse().map((submission) => {
    const documents = (submission.documents || []).map((doc) => `<li>${escapeHTML(doc.name)} <small>(${escapeHTML(doc.type || 'unknown')}, ${escapeHTML(doc.sizeLabel)})</small></li>`).join('');
    return `
      <article class="submission-item">
        <h4>${escapeHTML(submission.applicationType)}</h4>
        <p><strong>Status:</strong> <span class="badge">${escapeHTML(submission.status || 'Submitted')}</span></p>
        <p><strong>Target:</strong> ${escapeHTML(submission.targetProgram)}</p>
        <p><strong>Submitted:</strong> ${new Date(submission.submittedAt).toLocaleString()}</p>
        <p><strong>Summary:</strong> ${escapeHTML(submission.summary)}</p>
        <ul class="list-tight">${documents}</ul>
      </article>`;
  }).join('');
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

  host.innerHTML = letters.map((letter) => `
    <article class="submission-item letter-item">
      <h4>Letter ID: ${escapeHTML(letter.letterId)}</h4>
      <p><strong>Program:</strong> ${escapeHTML(letter.applicationType)} – ${escapeHTML(letter.targetProgram)}</p>
      <p><strong>Issued On:</strong> ${new Date(letter.issuedAt).toLocaleString()}</p>
      <p><strong>Issued By:</strong> ${escapeHTML(letter.issuedBy)}</p>
      <p><strong>Letter Note:</strong> ${escapeHTML(letter.message)}</p>
    </article>
  `).join('');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
    const passwordHash = await hashPassword(String(data.get('password')));

    const student = await registerStudent({
      fullName: String(data.get('fullName')).trim(),
      email,
      phone: String(data.get('phone')).trim(),
      program: String(data.get('program')).trim(),
      passwordHash
    });

    sessionStorage.setItem(SESSION_KEY, student.id);
    window.location.href = 'portal-dashboard.html';
  } catch (error) {
    setFeedback(form, error.message || 'Unable to create your account right now.', true);
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
    const student = await loginStudent(email, passwordHash);

    sessionStorage.setItem(SESSION_KEY, student.id);
    window.location.href = 'portal-dashboard.html';
  } catch (error) {
    setFeedback(form, error.message || 'Unable to log in right now. Please try again.', true);
  }
}

async function handleApplicationSubmission(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.reportValidity();
    setFeedback(form, 'Please complete all fields and upload at least one document.', true);
    return;
  }

  const student = await getSessionStudent();
  if (!student) {
    window.location.href = 'portal-login.html';
    return;
  }

  const fileInput = document.getElementById('supporting-documents');
  const files = Array.from(fileInput?.files || []);
  if (!files.length) {
    setFeedback(form, 'Please upload at least one supporting document.', true);
    return;
  }

  try {
    const data = new FormData(form);
    const updatedStudent = await submitApplication(student.id, {
      applicationType: String(data.get('applicationType')).trim(),
      targetProgram: String(data.get('targetProgram')).trim(),
      summary: String(data.get('summary')).trim(),
      documents: files.map((f) => ({
        name: f.name,
        size: f.size,
        sizeLabel: formatSize(f.size),
        type: f.type || 'file'
      }))
    });

    setFeedback(form, 'Application submitted successfully with your uploaded documents.');
    form.reset();
    renderSubmissionHistory(updatedStudent);
    renderStudentStatus(updatedStudent);
    renderAdmissionLetters(updatedStudent);
  } catch (error) {
    setFeedback(form, error.message || 'Unable to submit application right now.', true);
  }
}

async function loadDashboard() {
  const student = await getSessionStudent();
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
  if (applicationForm) applicationForm.addEventListener('submit', handleApplicationSubmission);

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

  try {
    if (await hasBackend()) {
      const result = await apiRequest('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ ...result.admin, loggedInAt: new Date().toISOString() }));
      window.location.href = 'admin-dashboard.html';
      return;
    }

    if (email !== ADMIN_USER.email || password !== ADMIN_USER.password) {
      throw new Error('Invalid admin credentials.');
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ email: ADMIN_USER.email, name: ADMIN_USER.name, loggedInAt: new Date().toISOString() }));
    window.location.href = 'admin-dashboard.html';
  } catch (error) {
    setFeedback(form, error.message || 'Unable to sign in as admin.', true);
  }
}

function renderAdminSummary(summary) {
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };
  setValue('total-students', summary.totalStudents || 0);
  setValue('total-submissions', summary.totalSubmissions || 0);
  setValue('issued-letters', summary.issuedLetters || 0);
}

function renderAdminSubmissions(submissions) {
  const host = document.getElementById('admin-submissions');
  if (!host) return;

  if (!submissions.length) {
    host.innerHTML = '<p class="section-intro">No student submissions available yet.</p>';
    return;
  }

  host.innerHTML = submissions.slice().reverse().map((submission) => {
    const docs = (submission.documents || []).map((doc) => `<li>${escapeHTML(doc.name)} <small>(${escapeHTML(doc.sizeLabel)})</small></li>`).join('');
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
  }).join('');
}

async function refreshAdminDashboard() {
  const [summary, submissions] = await Promise.all([getAdminSummary(), getAdminSubmissions()]);
  renderAdminSummary(summary);
  renderAdminSubmissions(submissions);
}

async function loadAdminDashboard() {
  const session = getAdminSession();
  if (!session?.email) {
    window.location.href = 'admin-login.html';
    return;
  }

  const nameEl = document.getElementById('admin-name');
  if (nameEl) nameEl.textContent = session.name;

  await refreshAdminDashboard();

  const host = document.getElementById('admin-submissions');
  if (host) {
    host.addEventListener('click', async (event) => {
      const button = event.target.closest('.btn-save-status');
      if (!button) return;
      const container = button.closest('.admin-submission-item');
      if (!container) return;

      const studentId = container.dataset.studentId;
      const submissionId = container.dataset.submissionId;
      const statusSelect = container.querySelector('.admin-status-select');
      const selectedStatus = statusSelect ? statusSelect.value : 'Submitted';

      try {
        button.disabled = true;
        await updateSubmissionStatus(studentId, submissionId, selectedStatus);
        await refreshAdminDashboard();
      } catch (error) {
        alert(error.message || 'Unable to update status.');
      } finally {
        button.disabled = false;
      }
    });

    host.addEventListener('submit', async (event) => {
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

      try {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        await issueAdmissionLetter(studentId, submissionId, message, session.name || ADMIN_USER.name);
        await refreshAdminDashboard();
      } catch (error) {
        setFeedback(form, error.message || 'Unable to issue admission letter.', true);
      }
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
