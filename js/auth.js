import { getSessionUser, loginUser, notify, registerUser, safeNextPage, setupPasswordToggles } from "./core.js";

const page = document.body.dataset.page;
const form = document.querySelector("form");
const message = document.querySelector("#formMessage");
const submitButton = form.querySelector("button[type='submit']");
const nextPage = safeNextPage(page === "registro" ? "reservar.html" : "turnos.html");
setupPasswordToggles();

// Conserva el destino original al pasar de ingreso a registro o recuperación.
const switchLink = document.querySelector("[data-auth-switch]");
if (switchLink && new URLSearchParams(location.search).has("next")) {
  const target = new URL(switchLink.href);
  target.searchParams.set("next", nextPage);
  switchLink.href = target.href;
}

const recoveryLink = document.querySelector("[data-recovery-link]");
if (recoveryLink && new URLSearchParams(location.search).has("next")) {
  recoveryLink.href = `./recuperar.html?next=${encodeURIComponent(nextPage)}`;
}

if (getSessionUser()) {
  location.replace(`./${nextPage}`);
}

// Evita envíos repetidos mientras se procesa el formulario.
function setLoading(loading) {
  submitButton.disabled = loading;
  submitButton.textContent = loading ? "Procesando..." : page === "registro" ? "Crear mi cuenta →" : "Ingresar a mi cuenta →";
}

// El mismo controlador resuelve registro e ingreso según la página actual.
form.addEventListener("submit", async event => {
  event.preventDefault();
  message.textContent = "";
  setLoading(true);
  const data = new FormData(form);

  const result = page === "registro"
    ? await registerUser({ name: String(data.get("name")), lastName: String(data.get("lastName")), email: String(data.get("email")), password: String(data.get("password")) })
    : await loginUser({ email: String(data.get("email")), password: String(data.get("password")) });

  if (!result.ok) {
    message.textContent = result.message;
    setLoading(false);
    return;
  }

  notify(page === "registro" ? `Cuenta creada. ¡Hola, ${result.user.name}!` : `Bienvenido de nuevo, ${result.user.name}.`);
  window.setTimeout(() => { location.href = `./${nextPage}`; }, 650);
});
