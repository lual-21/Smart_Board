// --- DOM ELEMENTS ---
const container = document.getElementById("container");
const switchBtn = document.getElementById("switch");
const title = document.getElementById("title");
const text = document.getElementById("text");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let isSignup = false;

// --- PANEL SWITCHING LOGIC ---
switchBtn.addEventListener("click", () => {
  isSignup = !isSignup;
  container.classList.toggle("active");

  resetFormState();

  if (isSignup) {
    title.innerText = "Welcome Back!";
    text.innerText = "Already have an account? Login here.";
    switchBtn.innerText = "Login";
  } else {
    title.innerText = "Hello Friend!";
    text.innerText = "Create an account and start your learning journey.";
    switchBtn.innerText = "Sign Up";
  }
});

// --- SIGNUP FORM HANDLING (TEMPORARY STORAGE) ---
signupForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value.trim();

  const nameErr = document.getElementById("signupNameErr");
  const emailErr = document.getElementById("signupEmailErr");
  const passErr = document.getElementById("signupPassErr");
  const feedback = document.getElementById("signupFeedback");

  let isValid = true;

  // Name Validation
  if (name === "") {
    nameErr.style.display = "block";
    isValid = false;
  } else {
    nameErr.style.display = "none";
  }

  // Email Validation
  if (!emailRegex.test(email)) {
    emailErr.style.display = "block";
    isValid = false;
  } else {
    emailErr.style.display = "none";
  }

  // Password Validation
  if (password.length < 6) {
    passErr.style.display = "block";
    isValid = false;
  } else {
    passErr.style.display = "none";
  }

  if (isValid) {
    // Save account temporarily to localStorage
    const newUser = { name, email, password };
    localStorage.setItem("registeredUser", JSON.stringify(newUser));

    feedback.className = "form-feedback success";
    feedback.innerText = "Account created! Switching to login...";

    setTimeout(() => {
      // Auto-fill email field on login form
      document.getElementById("loginEmail").value = email;
      switchBtn.click(); // Switch panel to Login view
    }, 1200);
  } else {
    feedback.className = "form-feedback error";
    feedback.innerText = "Please complete the required fields.";
  }
});

// --- LOGIN FORM HANDLING (VERIFICATION) ---
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  const emailErr = document.getElementById("loginEmailErr");
  const passErr = document.getElementById("loginPassErr");
  const feedback = document.getElementById("loginFeedback");

  let isValid = true;

  if (!emailRegex.test(email)) {
    emailErr.style.display = "block";
    isValid = false;
  } else {
    emailErr.style.display = "none";
  }

  if (password.length < 6) {
    passErr.style.display = "block";
    isValid = false;
  } else {
    passErr.style.display = "none";
  }

  if (isValid) {
    // Retrieve stored user data
    const storedUser = JSON.parse(localStorage.getItem("registeredUser"));

    if (storedUser && storedUser.email === email && storedUser.password === password) {
      // Save active session temporarily
      sessionStorage.setItem("activeSession", JSON.stringify(storedUser));

      feedback.className = "form-feedback success";
      feedback.innerText = "Login successful! Redirecting...";

      setTimeout(() => {
        window.location.href = "board.html";
      }, 1000);
    } else {
      feedback.className = "form-feedback error";
      feedback.innerText = "Invalid credentials or account does not exist.";
    }
  } else {
    feedback.className = "form-feedback error";
    feedback.innerText = "Please check your inputs.";
  }
});

// --- HELPER FUNCTIONS ---
function resetFormState() {
  document.querySelectorAll(".error-msg").forEach(err => err.style.display = "none");
  document.querySelectorAll(".form-feedback").forEach(fb => fb.innerText = "");
  loginForm.reset();
  signupForm.reset();
}