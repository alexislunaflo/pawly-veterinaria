// Nombres únicos para mantener separados los datos guardados en el navegador.
const STORAGE_KEYS = {
  users: "pawly_users",
  session: "pawly_session",
  appointments: "pawly_appointments",
  pets: "pawly_pets"
};

// La promesa se reutiliza para no solicitar los mismos archivos JSON más de una vez.
let catalogRequest = null;

// Si localStorage contiene datos dañados, se devuelve el valor alternativo.
export function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Los tres catálogos se cargan en paralelo y se valida que todos sean arrays.
export async function loadCatalogs() {
  if (!catalogRequest) {
    catalogRequest = Promise.all([
      fetch("./data/veterinarias.json"),
      fetch("./data/especialidades.json"),
      fetch("./data/profesionales.json")
    ]).then(async responses => {
      if (responses.some(response => !response.ok)) throw new Error("catalog-load-error");
      const catalogs = await Promise.all(responses.map(response => response.json()));
      if (!catalogs.every(Array.isArray)) throw new Error("catalog-format-error");
      return { clinics: catalogs[0], specialties: catalogs[1], doctors: catalogs[2] };
    });
  }
  return catalogRequest;
}

// Busca una entidad por id sin repetir la misma operación en cada módulo.
export function getEntity(collection, id) {
  return collection.find(item => item.id === id);
}

export function getUsers() {
  return readStorage(STORAGE_KEYS.users, []);
}

export function getAppointments() {
  return readStorage(STORAGE_KEYS.appointments, []);
}

export function saveAppointments(appointments) {
  saveStorage(STORAGE_KEYS.appointments, appointments);
}

export function getPets() {
  return readStorage(STORAGE_KEYS.pets, []);
}

export function savePets(pets) {
  saveStorage(STORAGE_KEYS.pets, pets);
}

// La sesión guarda únicamente el id; los datos completos salen de la lista de usuarios.
export function getSessionUser() {
  const sessionId = localStorage.getItem(STORAGE_KEYS.session);
  return getUsers().find(user => user.id === sessionId) ?? null;
}

export function logoutUser() {
  localStorage.removeItem(STORAGE_KEYS.session);
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// Esta transformación alcanza para la simulación local, pero no reemplaza un backend seguro.
async function hashPassword(password) {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(password);
    const buffer = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join("");
  }
  return btoa(unescape(encodeURIComponent(password)));
}

export function createId(prefix) {
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

// Registra la cuenta, evita correos duplicados e inicia la sesión automáticamente.
export async function registerUser({ name, lastName, email, password }) {
  const users = getUsers();
  const normalizedEmail = normalizeEmail(email);
  if (users.some(user => user.email === normalizedEmail)) {
    return { ok: false, message: "Ya existe una cuenta con ese correo electrónico." };
  }

  const user = {
    id: createId("usr"),
    name: name.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString()
  };
  users.push(user);
  saveStorage(STORAGE_KEYS.users, users);
  localStorage.setItem(STORAGE_KEYS.session, user.id);
  return { ok: true, user };
}

// El ingreso compara el correo normalizado y la transformación de la contraseña.
export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const passwordHash = await hashPassword(password);
  const user = getUsers().find(item => item.email === normalizedEmail && item.passwordHash === passwordHash);
  if (!user) return { ok: false, message: "El correo o la contraseña no son correctos." };
  localStorage.setItem(STORAGE_KEYS.session, user.id);
  return { ok: true, user };
}

export function userExists(email) {
  const normalizedEmail = normalizeEmail(email);
  return getUsers().some(user => user.email === normalizedEmail);
}

// La recuperación actualiza solo la cuenta que coincide con el correo ingresado.
export async function resetUserPassword({ email, password }) {
  const users = getUsers();
  const normalizedEmail = normalizeEmail(email);
  const user = users.find(item => item.email === normalizedEmail);
  if (!user) return false;
  user.passwordHash = await hashPassword(password);
  user.updatedAt = new Date().toISOString();
  saveStorage(STORAGE_KEYS.users, users);
  return true;
}

// Reutiliza el mismo comportamiento de mostrar u ocultar contraseña en todos los formularios.
export function setupPasswordToggles(root = document) {
  root.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const input = button.closest(".password-control")?.querySelector("input");
      if (!input) return;
      const willShow = input.type === "password";
      input.type = willShow ? "text" : "password";
      button.textContent = willShow ? "Ocultar" : "Mostrar";
      button.setAttribute("aria-label", willShow ? "Ocultar contraseña" : "Mostrar contraseña");
    });
  });
}

// Escapa contenido dinámico antes de insertarlo con innerHTML.
export function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Utilidades de fecha y moneda con formato local de Argentina.
export function toLocalISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

export function formatDate(dateString, options = {}) {
  return new Intl.DateTimeFormat("es-AR", options).format(parseLocalDate(dateString));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

export function appointmentDateTime(appointment) {
  return new Date(`${appointment.date}T${appointment.time}:00`);
}

// Evita que el parámetro next redirija hacia una página ajena al proyecto.
export function safeNextPage(defaultPage) {
  const nextPage = new URLSearchParams(location.search).get("next");
  const allowedPages = new Set(["index.html", "reservar.html", "turnos.html", "mascotas.html", "veterinarias.html", "especialidades.html", "profesionales.html"]);
  return allowedPages.has(nextPage) ? nextPage : defaultPage;
}

// SweetAlert2 reemplaza los cuadros nativos para mensajes y decisiones.
export function notify(message, icon = "success") {
  if (!globalThis.Swal) return;
  globalThis.Swal.fire({
    toast: true,
    position: "bottom-end",
    icon,
    title: message,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    customClass: { popup: "pawly-swal" }
  });
}

export async function askDecision({ title, text, confirmText, icon = "question" }) {
  if (!globalThis.Swal) return false;
  const result = await globalThis.Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Volver",
    reverseButtons: true,
    confirmButtonColor: "#0e63d7",
    cancelButtonColor: "#61718d",
    customClass: { popup: "pawly-swal" }
  });
  return result.isConfirmed;
}

// Mensaje común para los casos en los que fetch no puede obtener los JSON.
export function renderLoadError(element) {
  element.innerHTML = `<div class="empty-block">No pudimos cargar los datos. Abrí el proyecto desde un servidor local y volvé a intentar.</div>`;
  notify("No se pudieron cargar los catálogos.", "error");
}
