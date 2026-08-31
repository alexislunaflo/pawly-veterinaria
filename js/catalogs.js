import { escapeHTML, formatCurrency, getEntity, loadCatalogs, renderLoadError } from "./core.js";

const page = document.body.dataset.page;
const DAY_NAMES = { 1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado" };
const CLINIC_REGIONS = ["Zona Oeste", "Capital", "Zona Norte"];
let catalogs;

// Convierte los identificadores de especialidad del JSON en nombres legibles.
function specialtyNames(ids) {
  return ids.map(id => getEntity(catalogs.specialties, id)?.name).filter(Boolean);
}

// Crea la tarjeta de una veterinaria con sus datos y accesos principales.
function clinicCard(clinic) {
  return `
    <article class="clinic-row">
      <div class="clinic-identity"><div><small>${escapeHTML(clinic.zone.toUpperCase())}</small><h3>${escapeHTML(clinic.name)}</h3></div><div class="rating"><b>★</b><strong>${clinic.rating}</strong><span>· ${clinic.reviews} opiniones</span></div></div>
      <div class="clinic-detail"><p><span>⌖</span>${escapeHTML(clinic.address)}</p><p><span>◷</span>${escapeHTML(clinic.hours)}</p><p><span>☎</span>${escapeHTML(clinic.phone)}</p><div class="tag-list">${specialtyNames(clinic.specialtyIds).map(name => `<span class="tag">${escapeHTML(name)}</span>`).join("")}</div></div>
      <div class="clinic-action"><a class="button button-primary" href="./reservar.html?clinic=${encodeURIComponent(clinic.id)}">Reservar acá</a><a href="./profesionales.html?clinic=${encodeURIComponent(clinic.id)}">Ver equipo →</a></div>
    </article>`;
}

// Agrupa las sedes visibles por región y actualiza el total de resultados.
function renderClinics(clinics) {
  const list = document.querySelector("#clinicList");
  const count = document.querySelector("#clinicCount");
  count.textContent = `${String(clinics.length).padStart(2, "0")} ${clinics.length === 1 ? "SEDE" : "SEDES"}`;
  if (!clinics.length) {
    list.innerHTML = `<div class="empty-block">No encontramos una sede con esa búsqueda.</div>`;
    return;
  }

  const availableRegions = [...CLINIC_REGIONS, ...new Set(clinics.map(clinic => clinic.region).filter(region => region && !CLINIC_REGIONS.includes(region)))];
  list.innerHTML = availableRegions.map(region => {
    const regionalClinics = clinics.filter(clinic => clinic.region === region);
    if (!regionalClinics.length) return "";
    const regionId = `zona-${region.toLocaleLowerCase("es").replaceAll(" ", "-")}`;
    return `
      <section class="clinic-zone" aria-labelledby="${escapeHTML(regionId)}">
        <header class="clinic-zone-header">
          <div><span>VETERINARIAS POR ZONA</span><h2 id="${escapeHTML(regionId)}">${escapeHTML(region)}</h2></div>
          <strong>${regionalClinics.length} ${regionalClinics.length === 1 ? "veterinaria" : "veterinarias"}</strong>
        </header>
        <div class="clinic-zone-list">${regionalClinics.map(clinicCard).join("")}</div>
      </section>`;
  }).join("");
}

function setupClinics() {
  const search = document.querySelector("#clinicSearch");
  const regionFilter = document.querySelector("#clinicRegionFilter");

  // El mismo filtro se ejecuta al escribir o al cambiar la zona seleccionada.
  const applyFilters = () => {
    const term = search.value.trim().toLocaleLowerCase("es");
    const filtered = catalogs.clinics.filter(clinic =>
      (!regionFilter.value || clinic.region === regionFilter.value) &&
      `${clinic.name} ${clinic.zone} ${clinic.region} ${clinic.address}`.toLocaleLowerCase("es").includes(term)
    );
    renderClinics(filtered);
  };

  search.addEventListener("input", applyFilters);
  regionFilter.addEventListener("change", applyFilters);
  applyFilters();
}

// Las especialidades provienen del JSON e incluyen precio y duración estimada.
function setupSpecialties() {
  const list = document.querySelector("#specialtyList");
  list.innerHTML = catalogs.specialties.map((specialty, index) => `
    <article class="specialty-row">
      <span class="specialty-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="specialty-symbol" aria-hidden="true">${escapeHTML(specialty.icon)}</span>
      <h2>${escapeHTML(specialty.name)}</h2>
      <div class="specialty-copy"><p>${escapeHTML(specialty.description)}</p><span>${escapeHTML(formatCurrency(specialty.price))} · ${specialty.durationMinutes} min</span></div>
      <a href="./profesionales.html?specialty=${encodeURIComponent(specialty.id)}">Ver profesionales →</a>
    </article>`).join("");
}

// Dibuja únicamente los profesionales que cumplen los filtros activos.
function renderDoctors(doctors) {
  const grid = document.querySelector("#professionalsGrid");
  document.querySelector("#doctorCount").textContent = `${String(doctors.length).padStart(2, "0")} PERFILES`;
  if (!doctors.length) {
    grid.innerHTML = `<div class="empty-block">No encontramos profesionales con esos filtros.</div>`;
    return;
  }

  grid.innerHTML = doctors.map(doctor => {
    const clinic = getEntity(catalogs.clinics, doctor.clinicId);
    const days = Object.keys(doctor.availability).map(day => DAY_NAMES[day]).filter(Boolean).join(", ");
    return `
      <article class="doctor-card">
        <div class="doctor-id-top"><span>ID / ${escapeHTML(doctor.license)}</span><b>● VERIFICADO</b></div>
        <div class="doctor-card-main"><span class="doctor-monogram">${escapeHTML(doctor.initials)}</span><div><h2>${escapeHTML(doctor.name)}</h2><span class="doctor-specialty">${escapeHTML(specialtyNames(doctor.specialtyIds).join(" / "))}</span></div></div>
        <div class="doctor-data"><p><strong>SEDE:</strong> ${escapeHTML(clinic?.name ?? "")}</p><p><strong>EXPERIENCIA:</strong> ${doctor.experience} años</p><p><strong>AGENDA:</strong> ${escapeHTML(days)}</p></div>
        <div class="doctor-card-footer"><a href="./veterinarias.html">Ver red</a><a href="./reservar.html?doctor=${encodeURIComponent(doctor.id)}">Reservar →</a></div>
      </article>`;
  }).join("");
}

function setupProfessionals() {
  const regionFilter = document.querySelector("#doctorRegionFilter");
  const clinicFilter = document.querySelector("#doctorClinicFilter");
  const specialtyFilter = document.querySelector("#doctorSpecialtyFilter");
  specialtyFilter.insertAdjacentHTML("beforeend", catalogs.specialties.map(specialty => `<option value="${escapeHTML(specialty.id)}">${escapeHTML(specialty.name)}</option>`).join(""));

  const parameters = new URLSearchParams(location.search);
  const requestedClinic = getEntity(catalogs.clinics, parameters.get("clinic"));
  const requestedRegion = parameters.get("region");
  regionFilter.value = requestedClinic?.region ?? (CLINIC_REGIONS.includes(requestedRegion) ? requestedRegion : "");
  specialtyFilter.value = parameters.get("specialty") ?? "";

  // Al elegir una zona se muestran en el segundo selector solo sus sedes.
  const updateClinicOptions = () => {
    const visibleClinics = catalogs.clinics.filter(clinic => !regionFilter.value || clinic.region === regionFilter.value);
    const previousClinic = clinicFilter.value || requestedClinic?.id || "";
    clinicFilter.innerHTML = `<option value="">Todas las sedes</option>${visibleClinics.map(clinic => `<option value="${escapeHTML(clinic.id)}">${escapeHTML(clinic.name)}</option>`).join("")}`;
    clinicFilter.value = visibleClinics.some(clinic => clinic.id === previousClinic) ? previousClinic : "";
  };

  // Los tres selectores pueden combinarse y siempre parten del catálogo original.
  const applyFilters = () => {
    const doctors = catalogs.doctors.filter(doctor =>
      (!regionFilter.value || getEntity(catalogs.clinics, doctor.clinicId)?.region === regionFilter.value) &&
      (!clinicFilter.value || doctor.clinicId === clinicFilter.value) &&
      (!specialtyFilter.value || doctor.specialtyIds.includes(specialtyFilter.value))
    );
    renderDoctors(doctors);
  };

  regionFilter.addEventListener("change", () => {
    updateClinicOptions();
    applyFilters();
  });
  clinicFilter.addEventListener("change", applyFilters);
  specialtyFilter.addEventListener("change", applyFilters);
  updateClinicOptions();
  applyFilters();
}

// Cada página de catálogo reutiliza este módulo y activa solo su sección.
async function initializeCatalogPage() {
  try {
    catalogs = await loadCatalogs();
    if (page === "veterinarias") setupClinics();
    if (page === "especialidades") setupSpecialties();
    if (page === "profesionales") setupProfessionals();
  } catch {
    const target = document.querySelector("#clinicList, #specialtyList, #professionalsGrid");
    renderLoadError(target);
  }
}

initializeCatalogPage();
