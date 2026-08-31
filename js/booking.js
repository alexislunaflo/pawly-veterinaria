import {
  createId,
  escapeHTML,
  formatCurrency,
  formatDate,
  getAppointments,
  getEntity,
  getPets,
  getSessionUser,
  loadCatalogs,
  notify,
  parseLocalDate,
  renderLoadError,
  saveAppointments,
  savePets,
  toLocalISO
} from "./core.js";

const STEP_TITLES = {
  1: "Elegí el tipo de atención",
  2: "Seleccioná un profesional",
  3: "Definí fecha y paciente",
  4: "Revisá el turno y el presupuesto"
};
const CLINIC_REGIONS = ["Zona Oeste", "Capital", "Zona Norte"];

const user = getSessionUser();
const gate = document.querySelector("#bookingGate");
const app = document.querySelector("#bookingApp");
let catalogs;
let appointments = getAppointments();
let pets = getPets();
let currentStep = 1;
let booking = emptyBooking();

const elements = {
  region: document.querySelector("#bookingRegionSelect"),
  clinic: document.querySelector("#clinicSelect"),
  specialty: document.querySelector("#specialtySelect"),
  doctors: document.querySelector("#doctorOptions"),
  date: document.querySelector("#appointmentDate"),
  slots: document.querySelector("#timeSlots"),
  savedPet: document.querySelector("#savedPetSelect"),
  selectedPetInfo: document.querySelector("#selectedPetInfo"),
  petName: document.querySelector("#petName"),
  petSpecies: document.querySelector("#petSpecies"),
  petBreed: document.querySelector("#petBreed"),
  petBirthDate: document.querySelector("#petBirthDate"),
  reason: document.querySelector("#appointmentReason"),
  rememberPet: document.querySelector("#rememberPet"),
  pricePreview: document.querySelector("#pricePreview"),
  summary: document.querySelector("#bookingSummary"),
  budget: document.querySelector("#budgetArea"),
  confirmButton: document.querySelector("#confirmBookingButton")
};

// Estado inicial de la reserva. Se reinicia sin recargar la página.
function emptyBooking() {
  return {
    region: "",
    clinicId: "",
    specialtyId: "",
    doctorId: "",
    date: "",
    time: "",
    petId: "",
    petName: "",
    petSpecies: "",
    petBreed: "",
    petBirthDate: "",
    reason: "",
    reminder: true,
    rescheduleId: null
  };
}

// La agenda permite reservar desde el día siguiente y hasta sesenta días después.
function configureDates() {
  const today = new Date();
  const minimum = new Date(today);
  minimum.setDate(minimum.getDate() + 1);
  const maximum = new Date(minimum);
  maximum.setDate(maximum.getDate() + 60);
  elements.date.min = toLocalISO(minimum);
  elements.date.max = toLocalISO(maximum);
  elements.petBirthDate.max = toLocalISO(today);
}

// Convierte la fecha de nacimiento en una edad breve para el resumen del paciente.
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

// Obtiene el precio desde la especialidad elegida en el catálogo.
function priceOfBooking() {
  return Number(getEntity(catalogs?.specialties ?? [], booking.specialtyId)?.price) || 0;
}

// Las zonas se toman del catálogo y conservan el mismo orden que en Veterinarias.
function populateRegions() {
  const availableRegions = CLINIC_REGIONS.filter(region => catalogs.clinics.some(clinic => clinic.region === region));
  elements.region.innerHTML = `<option value="">Seleccioná una zona</option>${availableRegions.map(region => `<option value="${escapeHTML(region)}">${escapeHTML(region)}</option>`).join("")}`;
  elements.region.value = booking.region;
}

// Después de elegir zona se muestran únicamente sus veterinarias.
function populateClinics() {
  const availableClinics = catalogs.clinics.filter(clinic => clinic.region === booking.region);
  if (booking.clinicId && !availableClinics.some(clinic => clinic.id === booking.clinicId)) booking.clinicId = "";
  elements.clinic.disabled = !booking.region;
  elements.clinic.innerHTML = booking.region
    ? `<option value="">Seleccioná una sede</option>${availableClinics.map(clinic => `<option value="${escapeHTML(clinic.id)}">${escapeHTML(clinic.name)} · ${escapeHTML(clinic.zone)}</option>`).join("")}`
    : `<option value="">Elegí primero una zona</option>`;
  elements.clinic.value = booking.clinicId;
}

function populateSpecialties() {
  const clinic = getEntity(catalogs.clinics, booking.clinicId);
  const available = clinic ? catalogs.specialties.filter(specialty => clinic.specialtyIds.includes(specialty.id)) : [];
  if (clinic && booking.specialtyId && !clinic.specialtyIds.includes(booking.specialtyId)) booking.specialtyId = "";
  elements.specialty.disabled = !clinic;
  elements.specialty.innerHTML = clinic
    ? `<option value="">Seleccioná una especialidad</option>${available.map(specialty => `<option value="${escapeHTML(specialty.id)}">${escapeHTML(specialty.name)} · ${escapeHTML(formatCurrency(specialty.price))}</option>`).join("")}`
    : `<option value="">Elegí primero una sede</option>`;
  elements.specialty.value = booking.specialtyId;
  renderPricePreview();
}

function populateSavedPets() {
  const userPets = pets.filter(pet => pet.userId === user.id);
  elements.savedPet.innerHTML = `<option value="">Cargar datos nuevos</option>${userPets.map(pet => `<option value="${escapeHTML(pet.id)}">${escapeHTML(pet.name)} · ${escapeHTML(pet.species)}</option>`).join("")}`;
  elements.savedPet.value = booking.petId;
  elements.savedPet.closest(".field").hidden = !userPets.length;
  renderSelectedPetInfo();
}

// Muestra datos adicionales cuando se elige una mascota guardada.
function renderSelectedPetInfo() {
  const pet = pets.find(item => item.id === booking.petId && item.userId === user.id);
  elements.selectedPetInfo.hidden = !pet;
  elements.selectedPetInfo.textContent = pet ? `${pet.breed || "Raza sin registrar"} · ${ageLabel(pet.birthDate)}` : "";
}

// Adelanta valor y duración antes de avanzar al siguiente paso.
function renderPricePreview() {
  const specialty = getEntity(catalogs?.specialties ?? [], booking.specialtyId);
  if (!specialty) {
    elements.pricePreview.innerHTML = `<p>Seleccioná una especialidad para consultar el valor estimado.</p>`;
    return;
  }
  elements.pricePreview.innerHTML = `<div><small>VALOR ORIENTATIVO DE LA CONSULTA</small><strong>${escapeHTML(formatCurrency(specialty.price))}</strong></div><p>Duración estimada: ${specialty.durationMinutes} minutos.</p>`;
}

// Un profesional debe trabajar en la sede y atender la especialidad seleccionada.
function matchingDoctors() {
  return catalogs.doctors.filter(doctor => doctor.clinicId === booking.clinicId && doctor.specialtyIds.includes(booking.specialtyId));
}

function renderDoctors() {
  const doctors = matchingDoctors();
  if (!doctors.length) {
    elements.doctors.innerHTML = `<p class="empty-inline">No hay profesionales disponibles para esa combinación.</p>`;
    return;
  }
  elements.doctors.innerHTML = doctors.map(doctor => `
    <button class="doctor-option ${booking.doctorId === doctor.id ? "selected" : ""}" type="button" data-action="select-doctor" data-doctor="${escapeHTML(doctor.id)}">
      <span class="option-monogram">${escapeHTML(doctor.initials)}</span><div><strong>${escapeHTML(doctor.name)}</strong><small>${doctor.experience} años de experiencia</small><small>${escapeHTML(doctor.license)}</small></div><span class="option-radio"></span>
    </button>`).join("");
}

// Quita de la agenda los horarios que ya tienen un turno confirmado.
function availableSlots() {
  const doctor = getEntity(catalogs.doctors, booking.doctorId);
  if (!doctor || !booking.date) return [];
  const schedule = doctor.availability[String(parseLocalDate(booking.date).getDay())] ?? [];
  const occupied = appointments
    .filter(item => item.id !== booking.rescheduleId && item.status === "confirmado" && item.doctorId === booking.doctorId && item.date === booking.date)
    .map(item => item.time);
  return schedule.filter(time => !occupied.includes(time));
}

function renderSlots() {
  if (!booking.date) {
    elements.slots.innerHTML = `<p class="empty-inline">Elegí una fecha para ver los horarios.</p>`;
    return;
  }
  const slots = availableSlots();
  if (!slots.includes(booking.time)) booking.time = "";
  elements.slots.innerHTML = slots.length
    ? slots.map(time => `<button class="time-slot ${booking.time === time ? "selected" : ""}" type="button" data-action="select-time" data-time="${time}">${time}</button>`).join("")
    : `<p class="empty-inline">El profesional no tiene horarios libres ese día. Probá con otra fecha.</p>`;
}

// El último paso reúne todos los datos para que el usuario pueda revisarlos.
function renderSummary() {
  const clinic = getEntity(catalogs.clinics, booking.clinicId);
  const specialty = getEntity(catalogs.specialties, booking.specialtyId);
  const doctor = getEntity(catalogs.doctors, booking.doctorId);
  elements.summary.innerHTML = `
    <article class="summary-ticket">
      <div class="summary-date"><strong>${parseLocalDate(booking.date).getDate()}</strong><span>${escapeHTML(formatDate(booking.date, { month: "short" }).replace(".", ""))} · ${escapeHTML(booking.time)} H</span></div>
      <div class="summary-content"><small>RESUMEN DE ATENCIÓN</small><h3>${escapeHTML(booking.petName)} con ${escapeHTML(doctor?.name ?? "")}</h3><p><strong>${escapeHTML(specialty?.name ?? "")}</strong> · ${escapeHTML(booking.petSpecies)} · ${escapeHTML(booking.petBreed)}</p><p>${escapeHTML(clinic?.name ?? "")} · ${escapeHTML(clinic?.address ?? "")}</p><p>Motivo: ${escapeHTML(booking.reason)}</p><div class="summary-price"><span>Consulta veterinaria</span><strong>${escapeHTML(formatCurrency(specialty?.price))}</strong></div></div>
    </article>`;
}

// El presupuesto es informativo y aclara qué conceptos no están incluidos.
function renderBudget() {
  const specialty = getEntity(catalogs.specialties, booking.specialtyId);
  elements.budget.innerHTML = `
    <section class="budget-confirmation">
      <div class="budget-heading"><div><small>PRESUPUESTO ORIENTATIVO</small><h3>${escapeHTML(specialty?.name ?? "Atención veterinaria")}</h3></div><strong>${escapeHTML(formatCurrency(priceOfBooking()))}</strong></div>
      <div class="budget-details"><p><span>Duración estimada</span><strong>${specialty?.durationMinutes ?? 0} minutos</strong></p><p><span>Incluye</span><strong>Consulta profesional</strong></p></div>
      <p class="budget-disclaimer">Estudios, medicación y procedimientos adicionales se presupuestan en la veterinaria.</p>
      <label class="check-option reminder-option"><input id="appointmentReminder" type="checkbox" ${booking.reminder ? "checked" : ""} /><span>Recordarme este turno 24 horas antes</span></label>
    </section>`;
  elements.confirmButton.innerHTML = booking.rescheduleId ? `Confirmar reprogramación <span>✓</span>` : `Confirmar turno <span>✓</span>`;
}

// Activa un solo panel y actualiza el indicador lateral del proceso.
function updateStep() {
  document.querySelectorAll("[data-booking-panel]").forEach(panel => {
    panel.hidden = Number(panel.dataset.bookingPanel) !== currentStep;
  });
  document.querySelectorAll("[data-step-marker]").forEach(marker => {
    const number = Number(marker.dataset.stepMarker);
    marker.classList.toggle("active", number === currentStep);
    marker.classList.toggle("complete", number < currentStep);
  });
  document.querySelector("#currentStep").textContent = String(currentStep).padStart(2, "0");
  document.querySelector("#bookingStepTitle").textContent = booking.rescheduleId && currentStep === 3 ? "Elegí una nueva fecha" : STEP_TITLES[currentStep];
  if (currentStep === 2) renderDoctors();
  if (currentStep === 3) renderSlots();
  if (currentStep === 4) {
    renderSummary();
    renderBudget();
  }
}

// Sincroniza los controles cuando se restaura o reinicia una reserva.
function syncFields() {
  elements.region.value = booking.region;
  elements.clinic.value = booking.clinicId;
  populateSpecialties();
  elements.specialty.value = booking.specialtyId;
  elements.date.value = booking.date;
  elements.savedPet.value = booking.petId;
  elements.petName.value = booking.petName;
  elements.petSpecies.value = booking.petSpecies;
  elements.petBreed.value = booking.petBreed;
  elements.petBirthDate.value = booking.petBirthDate;
  elements.reason.value = booking.reason;
  elements.rememberPet.checked = true;
  renderSelectedPetInfo();
}

// Cada paso valida únicamente los datos que necesita antes de continuar.
function validateStep() {
  if (currentStep === 1) {
    booking.region = elements.region.value;
    booking.clinicId = elements.clinic.value;
    booking.specialtyId = elements.specialty.value;
    if (!booking.region || !booking.clinicId || !booking.specialtyId) {
      notify("Seleccioná una zona, una sede y una especialidad.", "info");
      return false;
    }
  }
  if (currentStep === 2 && !booking.doctorId) {
    notify("Seleccioná un profesional.", "info");
    return false;
  }
  if (currentStep === 3) {
    booking.date = elements.date.value;
    booking.petName = elements.petName.value.trim();
    booking.petSpecies = elements.petSpecies.value;
    booking.petBreed = elements.petBreed.value.trim();
    booking.petBirthDate = elements.petBirthDate.value;
    booking.reason = elements.reason.value.trim();
    if (!booking.date || !booking.time) {
      notify("Seleccioná una fecha y un horario.", "info");
      return false;
    }
    if (!booking.petName || !booking.petSpecies || !booking.petBreed || !booking.petBirthDate || !booking.reason) {
      notify("Completá todos los datos de la mascota y el motivo de consulta.", "info");
      return false;
    }
    if (parseLocalDate(booking.petBirthDate) > new Date()) {
      notify("La fecha de nacimiento no puede ser futura.", "info");
      return false;
    }
    if (!availableSlots().includes(booking.time)) {
      notify("Ese horario ya no está disponible.", "error");
      renderSlots();
      return false;
    }
  }
  return true;
}

// Reutiliza una mascota existente o crea su perfil si el usuario lo solicita.
function savePetProfile() {
  let pet = pets.find(item => item.id === booking.petId && item.userId === user.id);
  if (!pet && !elements.rememberPet.checked) return "";
  if (!pet) {
    const normalizedName = booking.petName.toLocaleLowerCase("es");
    pet = pets.find(item => item.userId === user.id && item.name.toLocaleLowerCase("es") === normalizedName);
  }
  if (pet) {
    Object.assign(pet, { name: booking.petName, species: booking.petSpecies, breed: booking.petBreed, birthDate: booking.petBirthDate, updatedAt: new Date().toISOString() });
  } else {
    pet = { id: createId("pet"), userId: user.id, name: booking.petName, species: booking.petSpecies, breed: booking.petBreed, birthDate: booking.petBirthDate, nextVaccine: "", nextDeworming: "", createdAt: new Date().toISOString() };
    pets.push(pet);
  }
  savePets(pets);
  return pet.id;
}

// Limpia el circuito completo y vuelve al primer paso.
function resetBooking() {
  booking = emptyBooking();
  currentStep = 1;
  populateRegions();
  populateClinics();
  populateSpecialties();
  populateSavedPets();
  syncFields();
  renderSlots();
  updateStep();
  notify("Reserva reiniciada.", "info");
}

// Los parámetros permiten iniciar desde una sede, un profesional o una reprogramación.
function restoreFromUrl() {
  const parameters = new URLSearchParams(location.search);
  const rescheduleId = parameters.get("reschedule");
  if (rescheduleId) {
    const appointment = appointments.find(item => item.id === rescheduleId && item.userId === user.id && item.status === "confirmado");
    if (appointment) {
      const pet = pets.find(item => item.id === appointment.petId || (item.userId === user.id && item.name.toLocaleLowerCase("es") === appointment.petName.toLocaleLowerCase("es")));
      booking = {
        region: getEntity(catalogs.clinics, appointment.clinicId)?.region ?? "",
        clinicId: appointment.clinicId,
        specialtyId: appointment.specialtyId,
        doctorId: appointment.doctorId,
        date: appointment.date,
        time: appointment.time,
        petId: pet?.id ?? appointment.petId ?? "",
        petName: appointment.petName,
        petSpecies: appointment.petSpecies,
        petBreed: appointment.petBreed ?? pet?.breed ?? "",
        petBirthDate: appointment.petBirthDate ?? pet?.birthDate ?? "",
        reason: appointment.reason,
        reminder: appointment.reminder?.enabled !== false,
        rescheduleId: appointment.id
      };
      currentStep = 3;
      return;
    }
  }

  const requestedPet = pets.find(item => item.id === parameters.get("pet") && item.userId === user.id);
  if (requestedPet) {
    booking.petId = requestedPet.id;
    booking.petName = requestedPet.name;
    booking.petSpecies = requestedPet.species;
    booking.petBreed = requestedPet.breed ?? "";
    booking.petBirthDate = requestedPet.birthDate ?? "";
  }

  const doctor = getEntity(catalogs.doctors, parameters.get("doctor"));
  if (doctor) {
    booking.region = getEntity(catalogs.clinics, doctor.clinicId)?.region ?? "";
    booking.clinicId = doctor.clinicId;
    booking.specialtyId = doctor.specialtyIds[0];
    booking.doctorId = doctor.id;
    currentStep = 3;
    return;
  }
  const clinic = getEntity(catalogs.clinics, parameters.get("clinic"));
  if (clinic) {
    booking.region = clinic.region;
    booking.clinicId = clinic.id;
  }
}

// Vuelve a comprobar el horario antes de guardar para evitar reservas duplicadas.
function confirmBooking() {
  if (!availableSlots().includes(booking.time)) {
    notify("Ese horario dejó de estar disponible.", "error");
    currentStep = 3;
    updateStep();
    return;
  }
  booking.reminder = document.querySelector("#appointmentReminder")?.checked ?? true;
  const petId = savePetProfile();
  const specialty = getEntity(catalogs.specialties, booking.specialtyId);
  const appointmentData = {
    clinicId: booking.clinicId,
    specialtyId: booking.specialtyId,
    doctorId: booking.doctorId,
    date: booking.date,
    time: booking.time,
    petId,
    petName: booking.petName,
    petSpecies: booking.petSpecies,
    petBreed: booking.petBreed,
    petBirthDate: booking.petBirthDate,
    reason: booking.reason,
    price: priceOfBooking(),
    durationMinutes: specialty?.durationMinutes ?? 0,
    reminder: { enabled: booking.reminder, leadHours: 24 },
    status: "confirmado",
    updatedAt: new Date().toISOString()
  };

  if (booking.rescheduleId) {
    const appointment = appointments.find(item => item.id === booking.rescheduleId && item.userId === user.id);
    if (!appointment) return;
    Object.assign(appointment, appointmentData);
    saveAppointments(appointments);
    notify("Turno reprogramado correctamente.");
    window.setTimeout(() => { location.href = "./turnos.html?updated=1"; }, 800);
    return;
  }

  appointments.push({ id: createId("trn"), userId: user.id, ...appointmentData, createdAt: new Date().toISOString() });
  saveAppointments(appointments);
  notify("Turno confirmado. Ya está en tu agenda.");
  window.setTimeout(() => { location.href = "./turnos.html?new=1"; }, 800);
}

// Los eventos mantienen el estado de la reserva sincronizado con el DOM.
function attachEvents() {
  elements.region.addEventListener("change", event => {
    booking.region = event.target.value;
    booking.clinicId = "";
    booking.specialtyId = "";
    booking.doctorId = "";
    populateClinics();
    populateSpecialties();
  });
  elements.clinic.addEventListener("change", event => {
    booking.clinicId = event.target.value;
    booking.specialtyId = "";
    booking.doctorId = "";
    populateSpecialties();
  });
  elements.specialty.addEventListener("change", event => {
    booking.specialtyId = event.target.value;
    booking.doctorId = "";
    renderPricePreview();
  });
  elements.date.addEventListener("change", event => {
    booking.date = event.target.value;
    booking.time = "";
    renderSlots();
  });
  elements.savedPet.addEventListener("change", event => {
    booking.petId = event.target.value;
    const pet = pets.find(item => item.id === booking.petId && item.userId === user.id);
    if (!pet) {
      elements.petName.value = "";
      elements.petSpecies.value = "";
      elements.petBreed.value = "";
      elements.petBirthDate.value = "";
      renderSelectedPetInfo();
      return;
    }
    elements.petName.value = pet.name;
    elements.petSpecies.value = pet.species;
    elements.petBreed.value = pet.breed ?? "";
    elements.petBirthDate.value = pet.birthDate ?? "";
    elements.rememberPet.checked = true;
    renderSelectedPetInfo();
  });
  app.addEventListener("change", event => {
    if (event.target.id === "appointmentReminder") booking.reminder = event.target.checked;
  });
  app.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "next-step" && validateStep()) { currentStep += 1; updateStep(); }
    if (action === "previous-step") {
      if (booking.rescheduleId && currentStep === 3) {
        location.href = "./turnos.html";
        return;
      }
      currentStep -= 1;
      updateStep();
    }
    if (action === "reset-booking") resetBooking();
    if (action === "select-doctor") { booking.doctorId = target.dataset.doctor; booking.date = ""; booking.time = ""; renderDoctors(); }
    if (action === "select-time") { booking.time = target.dataset.time; renderSlots(); }
    if (action === "confirm-booking") confirmBooking();
  });
}

// La reserva requiere sesión y catálogos cargados correctamente.
async function initializeBooking() {
  if (!user) {
    gate.hidden = false;
    return;
  }
  gate.hidden = true;
  app.hidden = false;
  document.querySelector("#bookingUser").textContent = `${user.name} · nuevo turno`;
  configureDates();
  try {
    catalogs = await loadCatalogs();
    restoreFromUrl();
    populateRegions();
    populateClinics();
    populateSpecialties();
    populateSavedPets();
    syncFields();
    attachEvents();
    updateStep();
  } catch {
    renderLoadError(app);
  }
}

initializeBooking();
