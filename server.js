const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'students.json');
const ADMIN_USER = {
  email: 'admin@tolbertinnovationhub.org',
  password: 'Admin@12345',
  name: 'TIH Admissions Admin'
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readStudents() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

function writeStudents(students) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(students, null, 2), 'utf8');
}

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function safeStudent(student) {
  const { passwordHash, ...publicStudent } = student;
  return publicStudent;
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        req.destroy();
        reject(new Error('Request too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function createId() {
  return `tih-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
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

function authAdmin(body) {
  return body?.email === ADMIN_USER.email && body?.password === ADMIN_USER.password;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

async function handleApi(req, res, url) {
  setCors(res);
  if (req.method === 'OPTIONS') return sendText(res, 204, '');

  if (url.pathname === '/api/health' && req.method === 'GET') {
    return sendJSON(res, 200, { ok: true, mode: 'backend' });
  }

  if (url.pathname === '/api/register' && req.method === 'POST') {
    const body = await getBody(req);
    const students = readStudents();
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !body.passwordHash || !body.fullName) {
      return sendJSON(res, 400, { error: 'Missing required registration fields.' });
    }
    if (students.some((s) => s.email === email)) {
      return sendJSON(res, 409, { error: 'An account with this email already exists.' });
    }

    const student = {
      id: createId(),
      fullName: String(body.fullName).trim(),
      email,
      phone: String(body.phone || '').trim(),
      program: String(body.program || '').trim(),
      passwordHash: String(body.passwordHash),
      submissions: [],
      createdAt: new Date().toISOString()
    };
    students.push(student);
    writeStudents(students);
    return sendJSON(res, 201, { student: safeStudent(student) });
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    const body = await getBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const passwordHash = String(body.passwordHash || '');
    const students = readStudents();
    const student = students.find((s) => s.email === email && s.passwordHash === passwordHash);
    if (!student) return sendJSON(res, 401, { error: 'Invalid login credentials.' });
    return sendJSON(res, 200, { student: safeStudent(student) });
  }

  const studentMatch = url.pathname.match(/^\/api\/students\/([^/]+)$/);
  if (studentMatch && req.method === 'GET') {
    const students = readStudents();
    const student = students.find((s) => s.id === decodeURIComponent(studentMatch[1]));
    if (!student) return sendJSON(res, 404, { error: 'Student not found.' });
    return sendJSON(res, 200, { student: safeStudent(student) });
  }

  const submissionMatch = url.pathname.match(/^\/api\/students\/([^/]+)\/submissions$/);
  if (submissionMatch && req.method === 'POST') {
    const body = await getBody(req);
    const students = readStudents();
    const studentId = decodeURIComponent(submissionMatch[1]);
    const index = students.findIndex((s) => s.id === studentId);
    if (index === -1) return sendJSON(res, 404, { error: 'Student not found.' });

    const submission = {
      id: createId(),
      applicationType: String(body.applicationType || '').trim(),
      targetProgram: String(body.targetProgram || '').trim(),
      summary: String(body.summary || '').trim(),
      documents: Array.isArray(body.documents) ? body.documents : [],
      submittedAt: new Date().toISOString(),
      status: 'Submitted'
    };

    if (!submission.applicationType || !submission.targetProgram || !submission.summary) {
      return sendJSON(res, 400, { error: 'Submission fields are incomplete.' });
    }

    students[index].submissions = students[index].submissions || [];
    students[index].submissions.push(submission);
    writeStudents(students);
    return sendJSON(res, 201, { submission, student: safeStudent(students[index]) });
  }

  if (url.pathname === '/api/admin/login' && req.method === 'POST') {
    const body = await getBody(req);
    if (!authAdmin(body)) return sendJSON(res, 401, { error: 'Invalid admin credentials.' });
    return sendJSON(res, 200, { admin: { email: ADMIN_USER.email, name: ADMIN_USER.name } });
  }

  if (url.pathname === '/api/admin/submissions' && req.method === 'GET') {
    const students = readStudents();
    return sendJSON(res, 200, { submissions: getAllSubmissions(students) });
  }

  if (url.pathname === '/api/admin/summary' && req.method === 'GET') {
    const students = readStudents();
    const totalStudents = students.length;
    const totalSubmissions = students.reduce((count, s) => count + (s.submissions || []).length, 0);
    const issuedLetters = students.reduce((count, s) => count + (s.submissions || []).filter((x) => x.admissionLetter).length, 0);
    return sendJSON(res, 200, { totalStudents, totalSubmissions, issuedLetters });
  }

  const statusMatch = url.pathname.match(/^\/api\/admin\/submissions\/([^/]+)\/([^/]+)\/status$/);
  if (statusMatch && req.method === 'PATCH') {
    const body = await getBody(req);
    const students = readStudents();
    const [studentId, submissionId] = statusMatch.slice(1).map(decodeURIComponent);
    const studentIndex = students.findIndex((s) => s.id === studentId);
    if (studentIndex === -1) return sendJSON(res, 404, { error: 'Student not found.' });
    const submissionIndex = (students[studentIndex].submissions || []).findIndex((x) => x.id === submissionId);
    if (submissionIndex === -1) return sendJSON(res, 404, { error: 'Submission not found.' });

    students[studentIndex].submissions[submissionIndex].status = String(body.status || 'Submitted');
    writeStudents(students);
    return sendJSON(res, 200, { student: safeStudent(students[studentIndex]) });
  }

  const letterMatch = url.pathname.match(/^\/api\/admin\/submissions\/([^/]+)\/([^/]+)\/letter$/);
  if (letterMatch && req.method === 'POST') {
    const body = await getBody(req);
    const students = readStudents();
    const [studentId, submissionId] = letterMatch.slice(1).map(decodeURIComponent);
    const studentIndex = students.findIndex((s) => s.id === studentId);
    if (studentIndex === -1) return sendJSON(res, 404, { error: 'Student not found.' });
    const submissionIndex = (students[studentIndex].submissions || []).findIndex((x) => x.id === submissionId);
    if (submissionIndex === -1) return sendJSON(res, 404, { error: 'Submission not found.' });

    const letterId = `TIH-ADMIT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
    students[studentIndex].submissions[submissionIndex].status = 'Admission Letter Issued';
    students[studentIndex].submissions[submissionIndex].admissionLetter = {
      letterId,
      message: String(body.message || '').trim(),
      issuedAt: new Date().toISOString(),
      issuedBy: String(body.issuedBy || ADMIN_USER.name)
    };

    writeStudents(students);
    return sendJSON(res, 200, { student: safeStudent(students[studentIndex]) });
  }

  return sendJSON(res, 404, { error: 'API endpoint not found.' });
}

function serveStatic(req, res, url) {
  const reqPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const fullPath = path.join(ROOT, decodeURIComponent(reqPath));
  if (!fullPath.startsWith(ROOT)) {
    return sendText(res, 403, 'Forbidden');
  }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      return sendText(res, 404, 'Not Found');
    }

    res.writeHead(200, { 'Content-Type': contentType(fullPath) });
    fs.createReadStream(fullPath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    sendJSON(res, 500, { error: 'Server error', detail: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Tolbert Innovation Hub server running at http://localhost:${PORT}`);
});
