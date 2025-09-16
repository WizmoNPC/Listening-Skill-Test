// test.js — student info unlock, centered audio + timer, auto-submit & auto-advance
let attempts = []; 
let currentIndex = 0;

// ✅ Track overall results
let grandScore = 0;
let grandTotal = 0;
let allAnswers = []; // store answers for review at the end

const assignmentContainer = document.getElementById('assignmentContainer');
const questionsContainer = document.getElementById('questionsContainer');
const resultBox = document.getElementById('resultBox');
const overlay = document.getElementById('overlayMessage');
const overlayText = document.getElementById('overlayText');
const testSection = document.getElementById('test-section');
const snackbar = document.getElementById('snackbar');

let countdown = 60;
let timerInterval = null;

function toast(msg) {
  snackbar.textContent = msg;
  snackbar.classList.add('show');
  setTimeout(() => snackbar.classList.remove('show'), 2000);
}

// --- Read student info ---
const urlParams = new URLSearchParams(window.location.search);
const student = {
  name: urlParams.get("name"),
  roll: urlParams.get("roll"),
  college: urlParams.get("college")
};

if (!student.name || !student.roll || !student.college) {
  alert("Missing student details. Please register first.");
  window.location.href = "user.html";
}

// --- Load assignments ---
(async function init() {
  const res = await fetch("/api/assignments");
  const rows = await res.json();
  if (!rows || !rows.length) {
    toast("No assignments available.");
    return;
  }
  attempts = rows.map(a => ({ assignment_id: a.id, assignment_name: a.name }));
  testSection.style.display = "block";
  currentIndex = 0;
  loadAssignment(attempts[currentIndex]);
})();

function clearStage() {
  assignmentContainer.innerHTML = '';
  questionsContainer.innerHTML = '';
  resultBox.innerHTML = '';
  resultBox.style.display = 'none';

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  document.querySelectorAll('#assignmentAudio, #timerText').forEach(el => el.remove());
}

function loadAssignment(attempt) {
  clearStage(); 

  const container = document.createElement('div');
  container.className = 'set-card';

  const audioWrapper = document.createElement('div');
  audioWrapper.style.display = "flex";
  audioWrapper.style.flexDirection = "column";
  audioWrapper.style.alignItems = "center";
  audioWrapper.style.gap = "12px";
  audioWrapper.style.margin = "20px 0";

  const title = document.createElement('h3');
  title.className = 'audio-title';
  title.style.fontSize = "18px";
  title.style.fontWeight = "600";
  title.style.display = "block"; 
  title.innerHTML = `Time Left: <span id="timerText">01:00</span>`;

  // Audio player
  const audio = document.createElement('audio');
  audio.id = "assignmentAudio";
  audio.src = `/api/stream/${attempt.assignment_id}?name=${encodeURIComponent(student.name)}&roll=${encodeURIComponent(student.roll)}&college=${encodeURIComponent(student.college)}`;

  // ✅ hide download + playback speed menu
  audio.setAttribute("controlsList", "nodownload noplaybackrate");
  audio.controls = true;

  // ✅ Prevent any scrubbing or seeking backwards/forwards
  let lockPosition = 0;
  let alreadyPlayed = false;

  // start tracking as soon as play starts
  audio.addEventListener('play', () => {
    if (alreadyPlayed) {
      audio.pause();
      toast("Audio can only be played once.");
      return;
    }
    lockPosition = audio.currentTime;
  });

  // update lock position only when audio naturally advances
  audio.addEventListener('timeupdate', () => {
    if (audio.currentTime > lockPosition) {
      lockPosition = audio.currentTime; // update if forward naturally
    }
  });

  // block any seeking attempts
  audio.addEventListener('seeking', () => {
    if (audio.currentTime !== lockPosition) {
      audio.currentTime = lockPosition; // snap back to last played position
    }
  });

  // when audio ends, just mark it played and disable controls
  audio.addEventListener('ended', () => {
    alreadyPlayed = true;
    audio.controls = false; // hide controls after playing
    audio.pause();
  });

  audioWrapper.appendChild(title);
  audioWrapper.appendChild(audio);
  container.appendChild(audioWrapper);

  const info = document.createElement('p');
  info.style.textAlign = 'center';
  info.textContent = 'Listen carefully and answer the questions below.';
  container.appendChild(info);

  assignmentContainer.appendChild(container);

  // ✅ start timer and load questions immediately (audio + questions at same time)
  startTimer(document.getElementById("timerText"), attempt);
  loadQuestions(attempt.assignment_id);
}

async function loadQuestions(assignmentId) {
  const res = await fetch('/api/questions?assignmentId=' + assignmentId);
  const qs = await res.json();
  if (!qs.length) {
    questionsContainer.innerHTML = "<p class='muted'>No questions found.</p>";
    return;
  }
  qs.forEach((q, i) => {
    const block = document.createElement('div');
    block.className = 'card';
    block.dataset.qid = q.id;
    block.innerHTML = `<p><strong>Q${i + 1}.</strong> ${q.text}</p>`;

    q.choices.forEach(c => {
      const label = document.createElement('label');
      label.style.display = 'block';
      label.innerHTML = `<input type="radio" name="q_${q.id}" value="${c.id}"> ${c.label}`;
      block.appendChild(label);
    });

    questionsContainer.appendChild(block);
  });
}

function startTimer(timerEl, attempt) {
  countdown = 60;
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    countdown--;
    const m = String(Math.floor(countdown / 60)).padStart(2, '0');
    const s = String(countdown % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;

    if (countdown <= 15) timerEl.classList.add('danger');
    else timerEl.classList.remove('danger');

    if (countdown <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      autoSubmit(attempt);
    }
  }, 1000);
}

function collectAnswers() {
  const answers = [];
  questionsContainer.querySelectorAll('[data-qid]').forEach(b => {
    const qid = parseInt(b.dataset.qid, 10);
    const radio = b.querySelector('input[type=radio]:checked');
    if (radio) {
      answers.push({ questionId: qid, answer: radio.value });
    }
  });
  return answers;
}

// ✅ updated logic to accumulate and show combined results
async function autoSubmit(attempt) {
  const answers = collectAnswers();

  // submit answers for this assignment
  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      assignmentId: attempt.assignment_id,
      name: student.name,
      roll: student.roll,
      college: student.college,
      answers 
    })
  });

  const data = await res.json();

  // ✅ accumulate grand total and score
  if (data && typeof data.total === 'number' && typeof data.score === 'number') {
    grandScore += data.score;
    grandTotal += data.total;
  }

  // ✅ keep a record for review
  allAnswers.push({
    assignment: attempt.assignment_name,
    answers,
    score: data.score,
    total: data.total
  });

  toast("Time's up. Auto-submitted!");

  setTimeout(() => {
    currentIndex++;
    if (currentIndex < attempts.length) {
      overlay.style.display = 'flex';
      overlayText.textContent = 'Assignment submitted ✅ Loading next...';
      setTimeout(() => {
        overlay.style.display = 'none';
        loadAssignment(attempts[currentIndex]);
      }, 1200);
    } else {
      // ✅ All done: show combined result
      assignmentContainer.innerHTML = "<h3>All assignments completed 🎉</h3>";
      questionsContainer.innerHTML = "";

      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <h3>Overall Result</h3>
        <p>You scored <strong>${grandScore}</strong> out of <strong>${grandTotal}</strong> total questions across all sets</p>
        <div style="display:flex;justify-content:center;margin-top:10px;">
          ${renderMeter(grandScore, grandTotal)}
        </div>
        <h4 style="margin-top:16px;">Your Answers</h4>
        <ul>
          ${allAnswers.map(a => 
            `<li><strong>${a.assignment}</strong>: ${a.score}/${a.total} correct</li>`
          ).join('')}
        </ul>
      `;
    }
  }, 1000);
}

function renderMeter(score, total) {
  const percentage = (score / total) * 100;
  let face = "😢"; 
  if (percentage >= 80) face = "😁";
  else if (percentage >= 60) face = "😊";
  else if (percentage >= 40) face = "😐";
  else if (percentage >= 20) face = "☹️";

  return `<div style="font-size:40px;">${face}</div>`;
}
