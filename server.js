// server.js — MCQ-only, one-time audio stream, admin delete, users & CSV
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 🔹🔹🔹 Admin login route added here 🔹🔹🔹
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body;

  // ✅ Replace this with your own password or env var
  const correctPassword = process.env.ADMIN_PASSWORD || 'Shabu@911';

  if (password === correctPassword) {
    // Optionally set a cookie: res.cookie('isAdmin','true',{httpOnly:true});
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});
// 🔹🔹🔹 End admin login route 🔹🔹🔹

// --- Database ---
const db = new sqlite3.Database('./data.db');

db.run(`CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  audio_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.run(`CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER,
  name TEXT,
  roll TEXT,
  college TEXT,
  used INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.run(`CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL,
  qtype TEXT NOT NULL CHECK (qtype IN ('mcq','text')),
  text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.run(`CREATE TABLE IF NOT EXISTS choices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  is_correct INTEGER DEFAULT 0
)`);

db.run(`CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  answer_text TEXT,
  is_correct INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// --- Uploads ---
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// ---------- Assignments ----------
app.post('/api/assignment', upload.single('audio'), (req, res) => {
  const name = req.body.name?.trim() || 'Untitled Assignment';
  if (!req.file) return res.status(400).json({ error: 'Audio file is required.' });
  const audioPath = req.file.filename;
  db.run(
    'INSERT INTO assignments (name,audio_path) VALUES (?,?)',
    [name, audioPath],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, audio: audioPath });
    }
  );
});

app.get('/api/assignments', (_req, res) => {
  db.all('SELECT * FROM assignments ORDER BY created_at ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// ---------- Registration (no token) ----------
app.post('/api/register', (req, res) => {
  const { name, roll, college } = req.body || {};
  if (!name || !roll || !college) return res.status(400).json({ error: 'Missing fields.' });

  db.get(
    'SELECT id FROM attempts WHERE name=? AND roll=? AND college=? LIMIT 1',
    [name, roll, college],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) return res.status(400).json({ error: 'This student is already registered.' });

      db.all('SELECT id FROM assignments ORDER BY created_at ASC', [], (e2, asns) => {
        if (e2) return res.status(500).json({ error: e2.message });
        if (!asns.length) return res.status(400).json({ error: 'No assignments available.' });

        const stmt = db.prepare(
          'INSERT INTO attempts (assignment_id,name,roll,college) VALUES (?,?,?,?)'
        );
        asns.forEach(a => stmt.run([a.id, name, roll, college]));
        stmt.finalize(e3 => {
          if (e3) return res.status(500).json({ error: e3.message });
          res.json({ success: true });
        });
      });
    }
  );
});

// ---------- Audio stream (one-time only) ----------
app.get('/api/stream/:assignmentId', (req, res) => {
  const assignmentId = parseInt(req.params.assignmentId, 10);
  const { name, roll, college } = req.query;
  if (!assignmentId || !name || !roll || !college) return res.status(400).send('Invalid request');

  db.get(
    'SELECT * FROM attempts WHERE assignment_id=? AND name=? AND roll=? AND college=?',
    [assignmentId, name, roll, college],
    (err, attempt) => {
      if (err) return res.status(500).send('Database error');
      if (!attempt) return res.status(403).send('Not registered');

      // 🔹 If already used, allow only range continuation requests, block new playbacks
      if (attempt.used && !req.headers.range) {
        return res.status(403).send('Audio already played once.');
      }

      // 🔹 Mark as used only on the very first request
      if (!attempt.used) {
        db.run('UPDATE attempts SET used=1 WHERE id=?', [attempt.id]);
      }

      db.get('SELECT audio_path FROM assignments WHERE id=?', [assignmentId], (e2, a) => {
        if (e2 || !a) return res.status(404).send('No audio');
        const filePath = path.join(UPLOAD_DIR, a.audio_path);
        if (!fs.existsSync(filePath)) return res.status(404).send('File missing');

        const stat = fs.statSync(filePath);
        const range = req.headers.range;
        const contentType = mime.lookup(filePath) || 'audio/mpeg';

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
          const chunkSize = end - start + 1;
          const file = fs.createReadStream(filePath, { start, end });
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType,
          });
          file.pipe(res);
        } else {
          res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': contentType });
          fs.createReadStream(filePath).pipe(res);
        }
      });
    }
  );
});

// ---------- Questions (MCQ only) ----------
app.post('/api/question', (req, res) => {
  const { assignmentId, qtype, text, choices } = req.body || {};
  if (!assignmentId || !text) return res.status(400).json({ error: 'Missing fields.' });
  if (qtype !== 'mcq') return res.status(400).json({ error: 'Only MCQ questions are supported.' });

  // sanitize/validate choices
  const sanitized = Array.isArray(choices)
    ? choices
        .map(c => ({ label: String(c.label || '').trim(), is_correct: c.is_correct ? 1 : 0 }))
        .filter(c => c.label.length > 0)
    : [];

  if (sanitized.length < 2) {
    return res.status(400).json({ error: 'MCQ needs at least two choices.' });
  }
  const correctCount = sanitized.reduce((n, c) => n + (c.is_correct ? 1 : 0), 0);
  if (correctCount !== 1) {
    return res.status(400).json({ error: 'Exactly one choice must be marked correct.' });
  }

  db.run(
    'INSERT INTO questions (assignment_id,qtype,text) VALUES (?,?,?)',
    [assignmentId, 'mcq', text],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const qid = this.lastID;
      const stmt = db.prepare('INSERT INTO choices (question_id,label,is_correct) VALUES (?,?,?)');
      sanitized.forEach(c => stmt.run([qid, c.label, c.is_correct]));
      stmt.finalize(e2 => (e2 ? res.status(500).json({ error: e2.message }) : res.json({ id: qid })));
    }
  );
});

// list questions (MCQ only)
app.get('/api/questions', (req, res) => {
  const assignmentId = parseInt(req.query.assignmentId, 10);
  if (!assignmentId) return res.status(400).json({ error: 'assignmentId required' });

  db.all(
    'SELECT * FROM questions WHERE assignment_id=? AND qtype="mcq" ORDER BY id ASC',
    [assignmentId],
    (err, qs) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!qs?.length) return res.json([]);

      const ids = qs.map(q => q.id);
      const ph = ids.map(() => '?').join(',');
      db.all(`SELECT * FROM choices WHERE question_id IN (${ph}) ORDER BY id ASC`, ids, (e2, cs) => {
        if (e2) return res.status(500).json({ error: e2.message });
        const byQ = {};
        (cs || []).forEach(c => {
          (byQ[c.question_id] ||= []).push({ id: c.id, label: c.label });
        });
        res.json(qs.map(q => ({ id: q.id, qtype: 'mcq', text: q.text, choices: byQ[q.id] || [] })));
      });
    }
  );
});

// delete question (and its choices)
app.delete('/api/question/:id', (req, res) => {
  const qid = parseInt(req.params.id, 10);
  if (!qid) return res.status(400).json({ error: 'Invalid id' });
  db.run('DELETE FROM choices WHERE question_id=?', [qid], () => {
    db.run('DELETE FROM questions WHERE id=?', [qid], function (err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ deleted: this.changes });
    });
  });
});

// ---------- Submit answers (MCQ only scoring) ----------
app.post('/api/submit', (req, res) => {
  const { assignmentId, name, roll, college, answers } = req.body || {};
  if (!assignmentId || !name || !roll || !college || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Missing fields.' });
  }

  db.get(
    'SELECT * FROM attempts WHERE assignment_id=? AND name=? AND roll=? AND college=?',
    [assignmentId, name, roll, college],
    (err, attempt) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!attempt) return res.status(403).json({ error: 'Not registered' });

      db.all('SELECT * FROM questions WHERE assignment_id=? AND qtype="mcq"', [assignmentId], (e2, qs) => {
        if (e2) return res.status(500).json({ error: e2.message });
        if (!qs?.length) return res.json({ score: 0, total: 0 });

        const qids = qs.map(q => q.id);
        const ph = qids.map(() => '?').join(',');
        db.all(`SELECT * FROM choices WHERE question_id IN (${ph})`, qids, (e3, cs) => {
          if (e3) return res.status(500).json({ error: e3.message });

          const correctByQ = {};
          (cs || []).forEach(c => { if (c.is_correct) correctByQ[c.question_id] = c.id; });

          let score = 0, total = 0;
          const stmt = db.prepare(
            'INSERT INTO submissions (attempt_id,question_id,answer_text,is_correct) VALUES (?,?,?,?)'
          );

          answers.forEach(a => {
            const q = qs.find(qq => qq.id === a.questionId);
            if (!q) return;
            total++;
            const chosen = parseInt(a.answer, 10);
            const isCorrect = chosen === correctByQ[q.id] ? 1 : 0;
            if (isCorrect) score++;
            stmt.run([attempt.id, q.id, String(chosen || ''), isCorrect]);
          });

          stmt.finalize(() => {
            db.run('UPDATE attempts SET score=?, total=? WHERE id=?', [score, total, attempt.id]);
            res.json({ score, total });
          });
        });
      });
    }
  );
});

// ---------- Users list ----------
app.get('/api/users', (_req, res) => {
  db.all(
    `SELECT name, roll, college, MIN(created_at) as created_at,
            SUM(used) as used_count, COUNT(DISTINCT assignment_id) as total_assignments
     FROM attempts
     GROUP BY name, roll, college
     ORDER BY created_at ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load users' });
      res.json({ users: rows || [] });
    }
  );
});

// ---------- Answers per user ----------
app.get('/api/answers', (req, res) => {
  const { name, roll, college } = req.query;
  if (!name || !roll || !college) return res.status(400).json({ error: 'Missing params' });

  db.all(
    `SELECT a.name AS assignment, q.text AS question,
            COALESCE(c.label, s.answer_text) AS answer
     FROM submissions s
     JOIN attempts t ON s.attempt_id = t.id
     JOIN assignments a ON t.assignment_id = a.id
     JOIN questions q ON s.question_id = q.id
     LEFT JOIN choices c ON c.id = CAST(s.answer_text AS INTEGER)
     WHERE t.name=? AND t.roll=? AND t.college=?
     ORDER BY a.created_at ASC, q.id ASC`,
    [name, roll, college],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load answers' });
      res.json({ answers: rows || [] });
    }
  );
});

// ---------- CSV Export ----------
app.get('/api/export.csv', (_req, res) => {
  db.all(
    `SELECT t.name, t.roll, t.college,
            a.name AS assignment_name, q.text AS question_text, q.qtype,
            s.answer_text, c.label AS choice_label
     FROM submissions s
     JOIN attempts t ON t.id = s.attempt_id
     JOIN assignments a ON a.id = t.assignment_id
     JOIN questions q ON q.id = s.question_id
     LEFT JOIN choices c ON c.id = CAST(s.answer_text AS INTEGER)
     ORDER BY t.created_at ASC, a.created_at ASC, q.id ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send('Export failed');
      const header = 'Name,Roll,College,Assignment,Question,Answer\n';
      const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const body = (rows || []).map(r => {
        const ans = r.qtype === 'mcq' && r.choice_label ? r.choice_label : r.answer_text;
        return [esc(r.name), esc(r.roll), esc(r.college), esc(r.assignment_name), esc(r.question_text), esc(ans)].join(',');
      }).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
      res.send(header + body);
    }
  );
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
