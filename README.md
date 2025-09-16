# 🎧 Listening Skills Test Platform

A full-stack **Listening Skills Test Platform** built with **Node.js + Express + SQLite + Vanilla JS**.  
It allows admins to upload audio assignments and MCQs, and students to take timed listening tests with automatic scoring.

---

## ✨ Features

- **Admin Panel**  
  - Create assignments with audio files.  
  - Add MCQ questions with one correct answer.  
  - Export all submissions as CSV.  
  - View student registrations and their answers.  

- **Student Panel**  
  - Secure registration with name, roll, and college.  
  - One-time audio playback per assignment (no seeking, no download, no playback speed control).  
  - Timed questions displayed after audio ends.  
  - Auto-submission when time runs out.  
  - Cumulative scoring across multiple assignments.  

- **Security Measures**  
  - Audio files stored on the server with unique names.  
  - Audio streaming restricted to registered students.  
  - Audio playback allowed only once.  
  - Controls limited to prevent downloading or seeking.  

---

## 🗂 Folder Structure

project-root/
│
├── public/
│ ├── admin.html # Admin dashboard
│ ├── user.html # Student registration page
│ ├── test.html # Listening test page
│ ├── admin.js # Admin logic (upload audio + MCQs)
│ ├── test.js # Student test logic (audio + timer + auto-submit)
│ ├── userStyle.css # Styles for UI
│
├── uploads/ # Uploaded audio files
├── data.db # SQLite database
├── server.js # Express server (APIs + static)
└── README.md # Project documentation

🛠 Tech Stack

Backend: Node.js, Express

Database: SQLite

Frontend: Vanilla JavaScript, HTML5, CSS

File Uploads: Multer

Audio Streaming: HTML5 <audio> with Express range requests

📊 Scoring & Auto-Submit

Timer starts after audio ends.

Student answers MCQs within the time limit.

All answers automatically submitted after time expires.

Results displayed cumulatively across all assignments.

📝 License

This project is developed for internal/exam purposes.
You can customize or extend it as needed.
