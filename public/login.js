
// login.js - simple local login (no Firebase)

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const loginButton = document.getElementById('loginButton');
const errorBox = document.getElementById('errorBox');

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.style.display = 'block';
}

togglePasswordBtn?.addEventListener('click', () => {
  const type = passwordInput.type === 'password' ? 'text' : 'password';
  passwordInput.type = type;
});

loginButton?.addEventListener('click', () => {
  const u = usernameInput.value.trim();
  const p = passwordInput.value.trim();
  if (!u || !p) return showError('Please enter both username and password.');

  // Very simple role-based demo auth
  if (u === 'admin' && p === 'admin123') {
    window.location.href = 'admin.html';
  } else if (u === 'user' && p === 'user123') {
    window.location.href = 'user.html';
  } else {
    showError('Invalid credentials (try admin/admin123 or user/user123)');
  }
});

passwordInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginButton.click();
});
