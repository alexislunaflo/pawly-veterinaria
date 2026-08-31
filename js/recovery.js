import { normalizeEmail, notify, resetUserPassword, safeNextPage, setupPasswordToggles, userExists } from "./core.js";

const emailForm = document.querySelector("#recoverEmailForm");
const resetForm = document.querySelector("#resetPasswordForm");
const emailMessage = document.querySelector("[data-recovery-message='email']");
const resetMessage = document.querySelector("[data-recovery-message='reset']");
const nextPage = safeNextPage("turnos.html");
let recoveryEmail = "";
let recoveryCode = "";

setupPasswordToggles();

const loginReturn = document.querySelector("[data-login-return]");
loginReturn.href = `./login.html?next=${encodeURIComponent(nextPage)}`;

// Genera un código de seis cifras usando crypto cuando está disponible.
function createRecoveryCode() {
  if (globalThis.crypto?.getRandomValues) {
    const randomValue = new Uint32Array(1);
    globalThis.crypto.getRandomValues(randomValue);
    return String(100000 + (randomValue[0] % 900000));
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Devuelve el proceso al primer paso y limpia campos y mensajes.
function restartRecovery() {
  recoveryEmail = "";
  recoveryCode = "";
  emailForm.reset();
  resetForm.reset();
  emailMessage.textContent = "";
  resetMessage.textContent = "";
  emailForm.hidden = false;
  resetForm.hidden = true;
  emailForm.querySelector("input").focus();
}

// Primer paso: comprueba que la cuenta exista y muestra el código de la simulación.
emailForm.addEventListener("submit", event => {
  event.preventDefault();
  emailMessage.textContent = "";
  const data = new FormData(emailForm);
  recoveryEmail = normalizeEmail(String(data.get("email")));
  if (!userExists(recoveryEmail)) {
    emailMessage.textContent = "No encontramos una cuenta guardada con ese correo.";
    return;
  }
  recoveryCode = createRecoveryCode();
  document.querySelector("#recoveryEmailText").textContent = `Cuenta encontrada: ${recoveryEmail}`;
  document.querySelector("#demoRecoveryCode").textContent = recoveryCode;
  emailForm.hidden = true;
  resetForm.hidden = false;
  resetForm.querySelector("input[name='code']").focus();
});

// Segundo paso: valida código y contraseñas antes de actualizar la cuenta.
resetForm.addEventListener("submit", async event => {
  event.preventDefault();
  resetMessage.textContent = "";
  const data = new FormData(resetForm);
  const code = String(data.get("code")).trim();
  const password = String(data.get("password"));
  const passwordRepeat = String(data.get("passwordRepeat"));
  if (code !== recoveryCode) {
    resetMessage.textContent = "El código temporal no es correcto.";
    return;
  }
  if (password.length < 6) {
    resetMessage.textContent = "La contraseña debe tener al menos 6 caracteres.";
    return;
  }
  if (password !== passwordRepeat) {
    resetMessage.textContent = "Las contraseñas no coinciden.";
    return;
  }
  const updated = await resetUserPassword({ email: recoveryEmail, password });
  if (!updated) {
    resetMessage.textContent = "No pudimos actualizar la cuenta. Volvé a comenzar.";
    return;
  }
  notify("Contraseña actualizada. Ya podés ingresar.");
  window.setTimeout(() => { location.href = `./login.html?next=${encodeURIComponent(nextPage)}`; }, 700);
});

document.querySelector("#restartRecovery").addEventListener("click", restartRecovery);
