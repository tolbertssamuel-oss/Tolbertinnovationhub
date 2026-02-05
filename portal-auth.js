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

  if (students.some(s => s.email === email)) {
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
  const student = students.find(s => s.email === email && s.passwordHash === passwordHash);

  if (!student) {
    setFeedback(form, 'Invalid login credentials. Please try again.', true);
    return;
  }

  sessionStorage.setItem(SESSION_KEY, student.id);
  window.location.href = 'portal-dashboard.html';
}

function loadDashboard() {
  const sessionId = sessionStorage.getItem(SESSION_KEY);
  const students = getStudents();
  const student = students.find(s => s.id === sessionId);

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
