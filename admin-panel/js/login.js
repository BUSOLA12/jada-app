import { loginAdmin } from "./auth.js";
import { startButtonLoading } from "./buttonLoading.js";

const form = document.getElementById("login-form");
const errorBox = document.getElementById("error-box");

const setError = (message) => {
  if (!errorBox) {
    return;
  }

  if (!message) {
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
    return;
  }

  errorBox.classList.remove("hidden");
  errorBox.textContent = message;
};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError("");

  const email = String(form.email.value || "").trim();
  const password = String(form.password.value || "");
  const submitButton = form.querySelector("button[type='submit']");

  const stopLoading = startButtonLoading(submitButton, "Signing in...");

  try {
    await loginAdmin(email, password);
    window.location.href = "./index.html";
  } catch (error) {
    setError(error?.message || "Unable to sign in.");
  } finally {
    stopLoading();
  }
});
