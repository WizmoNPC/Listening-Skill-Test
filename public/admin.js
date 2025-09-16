// === Simple Admin Login Popup ===
const loginModalHtml = `
<div id="loginModal" style="
  position:fixed;top:0;left:0;width:100%;height:100%;
  background:rgba(0,0,0,0.6);display:flex;align-items:center;
  justify-content:center;z-index:9999;visibility:visible;">
  <div style="background:#fff;padding:20px;border-radius:8px;width:300px;text-align:center;">
    <h3>Admin Login</h3>
    <input type="password" id="adminPassword" placeholder="Enter Password" style="width:100%;padding:8px;">
    <button id="loginBtn" style="margin-top:10px;width:100%;">Login</button>
    <p id="loginError" style="color:red;font-size:12px;display:none;">Invalid password</p>
  </div>
</div>`;
document.body.insertAdjacentHTML('afterbegin', loginModalHtml);

const loginModal = document.getElementById('loginModal');
const loginBtn = document.getElementById('loginBtn');
const adminPasswordInput = document.getElementById('adminPassword');
const loginError = document.getElementById('loginError');

loginBtn.addEventListener('click', async () => {
  const password = adminPasswordInput.value.trim();
  // Call a backend endpoint to verify password
  const res = await fetch('/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (res.ok) {
    loginModal.style.visibility = 'hidden';
    sessionStorage.setItem('isAdmin', 'true'); // optional client-side flag
  } else {
    loginError.style.display = 'block';
  }
});

// Block all admin actions unless logged in
if (sessionStorage.getItem('isAdmin') !== 'true') {
  document.addEventListener('click', e => {
    if (loginModal.style.visibility === 'visible') e.preventDefault();
  }, true);
}

// =======================================================================
// Original admin.js code below (unchanged)
// =======================================================================

// admin.js — Admin dashboard: create assignment, add MCQs only (with correct answer), view users & export CSV

// --- Create Assignment ---
const assignmentNameInput = document.getElementById('assignmentName');
const audioUploadInput = document.getElementById('audioUpload');
const createAssignmentButton = document.getElementById('createAssignmentButton');

function showSnackbar(msg) {
  const s = document.getElementById('snackbar');
  s.textContent = msg;
  s.classList.add('show');
  setTimeout(() => s.classList.remove('show'), 2000);
}

createAssignmentButton?.addEventListener('click', async () => {
  const name = (assignmentNameInput?.value || '').trim();
  const file = audioUploadInput?.files?.[0];
  if (!name) return showSnackbar('Please enter an assignment name.');
  if (!file) return showSnackbar('Please upload an audio file.');

  const fd = new FormData();
  fd.append('name', name);
  fd.append('audio', file);

  createAssignmentButton.disabled = true;
  createAssignmentButton.textContent = 'Creating…';

  try {
    const res = await fetch('/api/assignment', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    showSnackbar('✅ Assignment created!');
    assignmentNameInput.value = '';
    audioUploadInput.value = '';
    await loadAssignmentsForQB();
    const sel = document.getElementById('qbAssignment');
    if (sel) sel.value = String(data.id);
  } catch (e) {
    console.error(e);
    showSnackbar('Error: ' + e.message);
  } finally {
    createAssignmentButton.disabled = false;
    createAssignmentButton.textContent = 'Create Assignment';
  }
});

// --- Question Builder (MCQ only) ---
const qbAssignment = document.getElementById('qbAssignment');
const qbText = document.getElementById('qbText');
const choicesWrap = document.getElementById('choicesWrap');
const addChoiceBtn = document.getElementById('addChoice');
const saveQuestionBtn = document.getElementById('saveQuestion');
const refreshQuestionsBtn = document.getElementById('refreshQuestions');
const questionList = document.getElementById('questionList');

function radio(name, value, checked = false) {
  return `
    <label style="display:flex;align-items:center;gap:8px;margin:4px 0;">
      <input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''} />
      <input type="text" class="choice-input" placeholder="Choice text" data-choice-id="${value}" />
      <span style="font-size:12px;color:#666;">${checked ? '✅ Correct' : ''}</span>
    </label>`;
}

async function loadAssignmentsForQB() {
  qbAssignment.innerHTML = '<option value="">Loading…</option>';
  try {
    const res = await fetch('/api/assignments');
    const rows = await res.json();
    qbAssignment.innerHTML =
      rows.map(a => `<option value="${a.id}">${a.name}</option>`).join('') ||
      '<option value="">No assignments</option>';
  } catch {
    qbAssignment.innerHTML = '<option value="">Error loading</option>';
  }
}

function resetChoices() {
  choicesWrap.innerHTML = '';
  choicesWrap.insertAdjacentHTML('beforeend', radio('correct', 1, true));
  choicesWrap.insertAdjacentHTML('beforeend', radio('correct', 2, false));
}

addChoiceBtn?.addEventListener('click', () => {
  const c = choicesWrap.querySelectorAll('label').length + 1;
  choicesWrap.insertAdjacentHTML('beforeend', radio('correct', c, false));
});

async function saveQuestion() {
  const assignmentId = parseInt(qbAssignment.value, 10);
  const text = (qbText.value || '').trim();
  if (!assignmentId) return alert('Choose an assignment.');
  if (!text) return alert('Enter question text.');

  const labels = Array.from(choicesWrap.querySelectorAll('input.choice-input'));
  if (labels.length < 2) return alert('Add at least two choices.');
  const correctVal =
    choicesWrap.querySelector('input[type="radio"][name="correct"]:checked')?.value || '1';

  const choices = labels
    .map((inp, idx) => ({
      label: inp.value.trim(),
      is_correct: String(idx + 1) === String(correctVal)
    }))
    .filter(c => c.label.length > 0);

  if (choices.length < 2) return alert('Each choice must have text.');
  if (!choices.some(c => c.is_correct)) return alert('Select the correct choice.');

  const payload = { assignmentId, qtype: 'mcq', text, choices };

  saveQuestionBtn.disabled = true;
  saveQuestionBtn.textContent = 'Saving…';
  try {
    const res = await fetch('/api/question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    qbText.value = '';
    resetChoices();
    await loadQuestions();
    showSnackbar('✅ Question added');
  } catch (e) {
    console.error(e);
    alert('Error: ' + e.message);
  } finally {
    saveQuestionBtn.disabled = false;
    saveQuestionBtn.textContent = 'Save Question';
  }
}

async function loadQuestions() {
  const assignmentId = parseInt(qbAssignment.value, 10);
  if (!assignmentId) {
    questionList.innerHTML = '<p>Select an assignment.</p>';
    return;
  }
  questionList.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const res = await fetch('/api/questions?assignmentId=' + assignmentId);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      questionList.innerHTML = '<p>No questions yet.</p>';
      return;
    }
    const container = document.createElement('div');
    rows.forEach(q => {
      const block = document.createElement('div');
      block.className = 'card';
      block.style.marginBottom = '10px';
      block.innerHTML = `
        <div class="card-head">
          <div class="step">MCQ</div>
          <h3 style="margin:0;">${q.text}</h3>
        </div>
        <ul style="margin-left:18px;">
          ${q.choices
            .map(c => `<li>${c.label} ${c.is_correct ? '✅' : ''}</li>`)
            .join('')}
        </ul>
        <div class="actions" style="margin-top:8px;">
          <button class="btn btn-ghost" data-del-id="${q.id}">Delete</button>
        </div>`;
      container.appendChild(block);
    });
    questionList.innerHTML = '';
    questionList.appendChild(container);
    questionList.querySelectorAll('button[data-del-id]').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id = e.currentTarget.getAttribute('data-del-id');
        if (!confirm('Delete this question?')) return;
        const r = await fetch('/api/question/' + id, { method: 'DELETE' });
        if (!r.ok) return alert('Delete failed');
        loadQuestions();
      });
    });
  } catch (e) {
    console.error(e);
    questionList.innerHTML = '<p>Error loading questions.</p>';
  }
}

qbAssignment?.addEventListener('change', loadQuestions);
saveQuestionBtn?.addEventListener('click', saveQuestion);
refreshQuestionsBtn?.addEventListener('click', loadQuestions);

// --- Users & CSV ---
const usersContainer = document.getElementById('usersContainer');
const refreshUsersBtn = document.getElementById('refreshUsers');
const downloadCsvBtn = document.getElementById('downloadCsv');

async function loadUsers() {
  usersContainer.innerHTML = '<p class="muted">Loading…</p>';
  try {
    const res = await fetch('/api/users');
    const obj = await res.json();
    const rows = obj.users || [];
    if (!rows.length) {
      usersContainer.innerHTML = '<p>No registrations yet.</p>';
      return;
    }

    const table = document.createElement('table');
    table.className = 'table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th><th>Name</th><th>Roll</th><th>College</th>
          <th>Assignments (used/total)</th><th>Created</th><th>Answers</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${r.name}</td>
        <td>${r.roll}</td>
        <td>${r.college}</td>
        <td>${r.used_count || 0}/${r.total_assignments || 0}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td><button class="btn btn-ghost" data-key="${r.name}|${r.roll}|${r.college}">View</button></td>
      `;
      tb.appendChild(tr);
    });
    usersContainer.innerHTML = '';
    usersContainer.appendChild(table);

    usersContainer.querySelectorAll('button[data-key]').forEach(btn => {
      btn.addEventListener('click', async e => {
        const [name, roll, college] = e.currentTarget
          .getAttribute('data-key')
          .split('|');
        const r = await fetch(
          `/api/answers?name=${encodeURIComponent(name)}&roll=${encodeURIComponent(
            roll
          )}&college=${encodeURIComponent(college)}`
        );
        const data = await r.json();
        const list = (data.answers || [])
          .map(
            a =>
              `<li><strong>${a.assignment}</strong> — ${a.question}<br/><em>${a.answer || ''}</em></li>`
          )
          .join('');
        const box = document.createElement('div');
        box.className = 'card';
        box.innerHTML = `<h3>Answers for ${name} (${roll}, ${college})</h3><ul>${
          list || '<li>No answers yet.</li>'
        }</ul>`;
        usersContainer.appendChild(box);
        box.scrollIntoView({ behavior: 'smooth' });
      });
    });
  } catch (e) {
    console.error(e);
    usersContainer.innerHTML = '<p>Error loading users.</p>';
  }
}

refreshUsersBtn?.addEventListener('click', loadUsers);
downloadCsvBtn?.addEventListener('click', () => {
  window.location.href = '/api/export.csv';
});

// init
document.addEventListener('DOMContentLoaded', async () => {
  await loadAssignmentsForQB();
  resetChoices();
  loadQuestions();
  loadUsers();
});
