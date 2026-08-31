import {
  appointmentDateTime,
  askDecision,
  createId,
  escapeHTML,
  formatDate,
  getAppointments,
  getEntity,
  getPets,
  getSessionUser,
  loadCatalogs,
  notify,
  parseLocalDate,
  renderLoadError,
  savePets,
  toLocalISO
} from "./core.js";

const user = getSessionUser();
const gate = document.querySelector("#petsGate");
const content = document.querySelector("#petsContent");
const list = document.querySelector("#petList");
const formPanel = document.querySelector("#petFormPanel");
const form = document.querySelector("#petForm");
let catalogs;
let pets = getPets();
const appointments = getAppointments();
let editingId = null;

const fields = {
  name: document.querySelector("#profilePetName"),
  species: document.querySelector("#profilePetSpecies"),
  breed: document.querySelector("#profilePetBreed"),
  birthDate: document.querySelector("#profilePetBirthDate"),
  nextVaccine: document.querySelector("#profileNextVaccine"),
  nextDeworming: document.querySelector("#profileNextDeworming")
};

// Cada usuario visualiza únicamente las mascotas asociadas a su cuenta.
function userPets() {
  return pets.filter(pet => pet.userId === user.id);
}

// Calcula una edad aproximada en años o meses para mostrarla en la ficha.
function ageLabel(dateString) {
  if (!dateString) return "Edad sin registrar";
  const birthDate = parseLocalDate(dateString);
  const today = new Date();
  let months = (today.getFullYear() - birthDate.getFullYear()) * 12 + today.getMonth() - birthDate.getMonth();
  if (today.getDate() < birthDate.getDate()) months -= 1;
  if (months < 12) return `${Math.max(months, 0)} mes${months === 1 ? "" : "es"}`;
  const years = Math.floor(months / 12);
  return `${years} año${years === 1 ? "" : "s"}`;
}

// Clasifica cada recordatorio según su cercanía o vencimiento.
function reminderState(dateString) {
  if (!dateString) return { className: "missing", label: "Sin fecha registrada", needsAttention: false };
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const target = parseLocalDate(dateString);
  const days = Math.ceil((target - today) / 86400000);
  if (days < 0) return { className: "overdue", label: `Vencido hace ${Math.abs(days)} día${days === -1 ? "" : "s"}`, needsAttention: true };
  if (days === 0) return { className: "soon", label: "Corresponde hoy", needsAttention: true };
  if (days <= 30) return { className: "soon", label: `En ${days} día${days === 1 ? "" : "s"} · ${formatDate(dateString)}`, needsAttention: true };
  return { className: "ok", label: formatDate(dateString), needsAttention: false };
}

// Vincula los turnos por id y conserva compatibilidad con perfiles anteriores.
function historyFor(pet) {
  const normalizedName = pet.name.toLocaleLowerCase("es");
  return appointments
    .filter(appointment => appointment.userId === user.id && (appointment.petId === pet.id || (!appointment.petId && appointment.petName.toLocaleLowerCase("es") === normalizedName)))
    .sort((first, second) => appointmentDateTime(second) - appointmentDateTime(first));
}

// Los turnos pasados se presentan como finalizados sin alterar localStorage.
function appointmentStatus(appointment) {
  if (appointment.status === "cancelado") return "cancelado";
  return appointmentDateTime(appointment) < new Date() ? "realizado" : "proximo";
}

// Genera el historial de consultas de una mascota dentro de su tarjeta.
function renderHistory(pet) {
  const history = historyFor(pet);
  if (!history.length) return `<div class="pet-history-empty">Todavía no hay turnos asociados a este perfil.</div>`;
  return `<div class="pet-history-list">${history.map(appointment => {
    const specialty = getEntity(catalogs.specialties, appointment.specialtyId);
    const clinic = getEntity(catalogs.clinics, appointment.clinicId);
    const status = appointmentStatus(appointment);
    const statusLabel = status === "proximo" ? "próximo" : status;
    return `<div class="pet-history-item"><div><strong>${escapeHTML(specialty?.name ?? "Consulta veterinaria")}</strong><span>${escapeHTML(formatDate(appointment.date))} · ${escapeHTML(appointment.time)} h · ${escapeHTML(clinic?.name ?? "")}</span></div><small class="${escapeHTML(status)}">${escapeHTML(statusLabel)}</small></div>`;
  }).join("")}</div>`;
}

// Actualiza listado, contador y estado vacío a partir de los datos guardados.
function renderPets() {
  const profiles = userPets();
  const attentionCount = profiles.reduce((total, pet) => total + Number(reminderState(pet.nextVaccine).needsAttention) + Number(reminderState(pet.nextDeworming).needsAttention), 0);
  const missingCount = profiles.reduce((total, pet) => total + Number(!pet.nextVaccine) + Number(!pet.nextDeworming), 0);
  document.querySelector("#petsTitle").textContent = `Mascotas de ${user.name}`;
  document.querySelector("#petsSubtitle").textContent = profiles.length ? `${profiles.length} perfil${profiles.length === 1 ? "" : "es"} guardado${profiles.length === 1 ? "" : "s"} en este navegador.` : "Todavía no agregaste ninguna mascota.";
  document.querySelector("#petHealthValue").textContent = `${profiles.length} perfil${profiles.length === 1 ? "" : "es"}`;
  document.querySelector("#petHealthCaption").textContent = attentionCount
    ? `${attentionCount} recordatorio${attentionCount === 1 ? "" : "s"} requiere${attentionCount === 1 ? "" : "n"} atención`
    : missingCount ? `${missingCount} fecha${missingCount === 1 ? "" : "s"} sanitaria${missingCount === 1 ? "" : "s"} por completar`
      : profiles.length ? "Sin recordatorios próximos" : "Creá la primera ficha de salud";

  if (!profiles.length) {
    list.innerHTML = `<div class="auth-required"><div class="auth-required-inner"><span class="auth-required-icon">+</span><h2>Creá su primera ficha.</h2><p>Después vas a poder seleccionarla al reservar y consultar su historial.</p><div class="auth-required-actions"><button class="button button-primary" type="button" data-new-pet>Agregar mascota</button></div></div></div>`;
    return;
  }

  list.innerHTML = profiles.map(pet => {
    const vaccine = reminderState(pet.nextVaccine);
    const deworming = reminderState(pet.nextDeworming);
    const historyCount = historyFor(pet).length;
    return `
      <article class="pet-card">
        <div class="pet-card-head"><span class="pet-avatar">${escapeHTML(pet.name.slice(0, 1).toUpperCase())}</span><div><small>${escapeHTML(pet.species.toUpperCase())}</small><h2>${escapeHTML(pet.name)}</h2><p>${escapeHTML(pet.breed || "Raza sin registrar")} · ${escapeHTML(ageLabel(pet.birthDate))}</p></div><div class="pet-card-actions"><button type="button" data-edit-pet="${escapeHTML(pet.id)}">Editar</button><button type="button" data-delete-pet="${escapeHTML(pet.id)}">Eliminar</button></div></div>
        <div class="pet-health-grid"><div class="health-reminder ${vaccine.className}"><small>PRÓXIMA VACUNA</small><strong>${escapeHTML(vaccine.label)}</strong></div><div class="health-reminder ${deworming.className}"><small>DESPARASITACIÓN</small><strong>${escapeHTML(deworming.label)}</strong></div></div>
        <div class="pet-history"><div class="pet-history-head"><h3>Historial de turnos</h3><span>${historyCount} consulta${historyCount === 1 ? "" : "s"}</span></div>${renderHistory(pet)}</div>
        <div class="pet-card-footer"><a href="./reservar.html?pet=${encodeURIComponent(pet.id)}">Reservar para ${escapeHTML(pet.name)} <span>→</span></a></div>
      </article>`;
  }).join("");
}

// Deja el formulario preparado para crear un perfil nuevo.
function resetForm() {
  editingId = null;
  form.reset();
  document.querySelector("#petFormTitle").textContent = "Nueva mascota";
}

// El mismo formulario sirve para alta y edición de mascotas.
function openForm(pet = null) {
  resetForm();
  if (pet) {
    editingId = pet.id;
    document.querySelector("#petFormTitle").textContent = `Editar a ${pet.name}`;
    fields.name.value = pet.name;
    fields.species.value = pet.species;
    fields.breed.value = pet.breed ?? "";
    fields.birthDate.value = pet.birthDate ?? "";
    fields.nextVaccine.value = pet.nextVaccine ?? "";
    fields.nextDeworming.value = pet.nextDeworming ?? "";
  }
  formPanel.hidden = false;
  formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeForm() {
  formPanel.hidden = true;
  resetForm();
}

// Comprueba datos obligatorios y evita fechas futuras o recordatorios incoherentes.
function validateForm(profile) {
  if (!profile.name || !profile.species || !profile.breed || !profile.birthDate) {
    notify("Completá nombre, especie, raza y fecha de nacimiento.", "info");
    return false;
  }
  if (parseLocalDate(profile.birthDate) > new Date()) {
    notify("La fecha de nacimiento no puede ser futura.", "info");
    return false;
  }
  const duplicate = userPets().find(pet => pet.id !== editingId && pet.name.toLocaleLowerCase("es") === profile.name.toLocaleLowerCase("es"));
  if (duplicate) {
    notify("Ya existe una mascota con ese nombre.", "info");
    return false;
  }
  return true;
}

// Guarda un perfil nuevo o reemplaza los datos del perfil editado.
form.addEventListener("submit", event => {
  event.preventDefault();
  const profile = {
    name: fields.name.value.trim(),
    species: fields.species.value,
    breed: fields.breed.value.trim(),
    birthDate: fields.birthDate.value,
    nextVaccine: fields.nextVaccine.value,
    nextDeworming: fields.nextDeworming.value
  };
  if (!validateForm(profile)) return;
  const existing = pets.find(pet => pet.id === editingId && pet.userId === user.id);
  if (existing) {
    Object.assign(existing, profile, { updatedAt: new Date().toISOString() });
  } else {
    pets.push({ id: createId("pet"), userId: user.id, ...profile, createdAt: new Date().toISOString() });
  }
  savePets(pets);
  closeForm();
  renderPets();
  notify(existing ? "Perfil actualizado." : "Mascota agregada.");
});

// La delegación administra botones creados dinámicamente en cada tarjeta.
document.addEventListener("click", async event => {
  if (event.target.closest("[data-new-pet]")) {
    openForm();
    return;
  }
  if (event.target.closest("[data-close-pet-form]")) {
    closeForm();
    return;
  }
  const editButton = event.target.closest("[data-edit-pet]");
  if (editButton) {
    const pet = pets.find(item => item.id === editButton.dataset.editPet && item.userId === user.id);
    if (pet) openForm(pet);
    return;
  }
  const deleteButton = event.target.closest("[data-delete-pet]");
  if (!deleteButton) return;
  const pet = pets.find(item => item.id === deleteButton.dataset.deletePet && item.userId === user.id);
  if (!pet) return;
  const accepted = await askDecision({ title: `¿Eliminar el perfil de ${pet.name}?`, text: "Sus turnos seguirán disponibles en tu agenda.", confirmText: "Eliminar perfil", icon: "warning" });
  if (!accepted) return;
  pets = pets.filter(item => item.id !== pet.id);
  savePets(pets);
  renderPets();
  notify("Perfil eliminado.", "info");
});

// Con sesión activa se cargan catálogos e historial; de lo contrario aparece el acceso.
async function initializePets() {
  if (!user) {
    gate.hidden = false;
    document.querySelector("#petHealthValue").textContent = "Cuenta";
    document.querySelector("#petHealthCaption").textContent = "Ingresá para ver tus perfiles";
    return;
  }
  gate.hidden = true;
  content.hidden = false;
  fields.birthDate.max = toLocalISO(new Date());
  try {
    catalogs = await loadCatalogs();
    renderPets();
    const attentionCount = userPets().reduce((total, pet) => total + Number(reminderState(pet.nextVaccine).needsAttention) + Number(reminderState(pet.nextDeworming).needsAttention), 0);
    if (attentionCount) notify(`Tenés ${attentionCount} recordatorio${attentionCount === 1 ? "" : "s"} sanitario${attentionCount === 1 ? "" : "s"} para revisar.`, "info");
  } catch {
    renderLoadError(list);
  }
}

initializePets();
