import {
  appointmentDateTime,
  askDecision,
  escapeHTML,
  formatCurrency,
  formatDate,
  getAppointments,
  getEntity,
  getSessionUser,
  loadCatalogs,
  notify,
  parseLocalDate,
  renderLoadError,
  saveAppointments
} from "./core.js";

const user = getSessionUser();
const gate = document.querySelector("#appointmentsGate");
const content = document.querySelector("#appointmentsContent");
const list = document.querySelector("#appointmentList");
let catalogs;
let appointments = getAppointments();

// El estado finalizado se calcula por fecha para no modificar el dato guardado.
function statusOf(appointment) {
  if (appointment.status === "cancelado") return "cancelado";
  if (appointmentDateTime(appointment) < new Date()) return "finalizado";
  return "confirmado";
}

// Muestra solo los turnos de la sesión actual y los ordena cronológicamente.
function renderAppointments() {
  const userAppointments = appointments
    .filter(appointment => appointment.userId === user.id)
    .sort((first, second) => appointmentDateTime(first) - appointmentDateTime(second));
  document.querySelector("#appointmentsTitle").textContent = `Agenda de ${user.name}`;
  document.querySelector("#appointmentsSubtitle").textContent = userAppointments.length
    ? `${userAppointments.length} turno${userAppointments.length === 1 ? "" : "s"} registrado${userAppointments.length === 1 ? "" : "s"} en este navegador.`
    : "Todavía no tenés turnos registrados.";
  if (!userAppointments.length) {
    list.innerHTML = `<div class="auth-required"><div class="auth-required-inner"><span class="auth-required-icon">+</span><h2>Tu agenda está vacía.</h2><p>Elegí una sede, un profesional y un horario para crear tu primer turno.</p><div class="auth-required-actions"><a class="button button-primary" href="./reservar.html">Reservar mi primer turno</a></div></div></div>`;
    return;
  }

  list.innerHTML = userAppointments.map(appointment => {
    const clinic = getEntity(catalogs.clinics, appointment.clinicId);
    const specialty = getEntity(catalogs.specialties, appointment.specialtyId);
    const doctor = getEntity(catalogs.doctors, appointment.doctorId);
    const status = statusOf(appointment);
    const manageable = status === "confirmado";
    const amount = Number(appointment.price ?? specialty?.price) || 0;
    const duration = Number(appointment.durationMinutes ?? specialty?.durationMinutes) || 0;
    const reminder = appointment.reminder?.enabled ? `<span class="reminder-badge">Recordatorio 24 h</span>` : "";
    const actions = manageable ? `<div class="appointment-actions"><a href="./reservar.html?reschedule=${encodeURIComponent(appointment.id)}">Reprogramar</a><button class="cancel-button" type="button" data-cancel="${escapeHTML(appointment.id)}">Cancelar turno</button></div>` : "";

    return `
      <article class="appointment-item ${status === "cancelado" ? "cancelled" : ""}">
        <div class="appointment-date"><strong>${parseLocalDate(appointment.date).getDate()}</strong><span>${escapeHTML(formatDate(appointment.date, { month: "short" }).replace(".", ""))}</span></div>
        <div class="appointment-info"><h3>${escapeHTML(appointment.petName)} · ${escapeHTML(specialty?.name ?? "Consulta")}</h3><p>${escapeHTML(doctor?.name ?? "")} · ${escapeHTML(appointment.time)} h · ${duration} min</p><p>${escapeHTML(clinic?.name ?? "")} · ${escapeHTML(clinic?.address ?? "")}</p><div class="appointment-badges"><span class="appointment-status ${status === "cancelado" ? "cancelado" : ""}">${escapeHTML(status)}</span><span class="price-badge">Consulta · ${escapeHTML(formatCurrency(amount))}</span>${reminder}</div></div>
        ${actions}
      </article>`;
  }).join("");
}

// La cancelación usa delegación porque las tarjetas se generan dinámicamente.
list.addEventListener("click", async event => {
  const cancelButton = event.target.closest("[data-cancel]");
  if (!cancelButton) return;
  const appointment = appointments.find(item => item.id === cancelButton.dataset.cancel && item.userId === user.id);
  if (!appointment) return;
  const accepted = await askDecision({ title: "¿Cancelar este turno?", text: `El horario de ${appointment.petName} volverá a quedar disponible.`, confirmText: "Sí, cancelar", icon: "warning" });
  if (!accepted) return;
  appointment.status = "cancelado";
  appointment.updatedAt = new Date().toISOString();
  saveAppointments(appointments);
  renderAppointments();
  notify("Turno cancelado.", "info");
});

// Sin sesión se muestra el acceso restringido; con sesión se cargan los catálogos.
async function initializeAppointments() {
  if (!user) {
    gate.hidden = false;
    return;
  }
  gate.hidden = true;
  content.hidden = false;
  try {
    catalogs = await loadCatalogs();
    renderAppointments();
  } catch {
    renderLoadError(list);
  }
}

initializeAppointments();
