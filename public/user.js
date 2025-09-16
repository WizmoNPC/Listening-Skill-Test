// user.js (Register → Auto-redirect to test.html)
const startTestBtn = document.getElementById("startTestBtn");
const clearFormBtn = document.getElementById("clearFormBtn");
const nameInput = document.getElementById("userName");
const collegeInput = document.getElementById("collegeName");
const rollInput = document.getElementById("rollNo");
const snackbar = document.getElementById("snackbar");

function toast(msg) {
  snackbar.textContent = msg;
  snackbar.classList.add("show");
  setTimeout(() => snackbar.classList.remove("show"), 2000);
}

startTestBtn?.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const college = collegeInput.value.trim();
  const roll = rollInput.value.trim();
  if (!name || !college || !roll) return toast("Please fill all details.");

  startTestBtn.disabled = true;
  startTestBtn.textContent = "Registering…";

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, roll, college })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    // 👉 Redirect immediately to test.html with user details
    const query = `name=${encodeURIComponent(name)}&roll=${encodeURIComponent(roll)}&college=${encodeURIComponent(college)}`;
    window.location.href = `test.html?${query}`;

  } catch (e) {
    toast(e.message);
  } finally {
    startTestBtn.disabled = false;
    startTestBtn.textContent = "Start Test";
  }
});

clearFormBtn?.addEventListener("click", () => {
  nameInput.value = "";
  collegeInput.value = "";
  rollInput.value = "";
  nameInput.focus();
});
