import { askDecision, getSessionUser, logoutUser, notify } from "./core.js";

const currentPage = document.body.dataset.page;
const sessionUser = getSessionUser();
const menuButton = document.querySelector("[data-menu-toggle]");
const mobileNav = document.querySelector("#mobileNav");

// Marca la sección actual y completa el año del pie de página.
document.querySelector(`[data-nav="${currentPage}"]`)?.classList.add("active");
document.querySelectorAll("[data-year]").forEach(element => {
  element.textContent = new Date().getFullYear();
});

// Si existe una sesión, el enlace de ingreso pasa a funcionar como cierre de sesión.
function updateSessionLinks() {
  const desktopLink = document.querySelector("[data-auth-link]");
  const mobileLink = document.querySelector("[data-mobile-auth]");
  if (!sessionUser) return;
  if (desktopLink) {
    desktopLink.textContent = `Salir · ${sessionUser.name}`;
    desktopLink.href = "#cerrar-sesion";
    desktopLink.dataset.logout = "true";
  }
  if (mobileLink) {
    mobileLink.textContent = `Cerrar sesión (${sessionUser.name})`;
    mobileLink.href = "#cerrar-sesion";
    mobileLink.dataset.logout = "true";
  }
}

// Mantiene sincronizados el menú móvil y su atributo accesible.
function closeMenu() {
  if (!mobileNav || !menuButton) return;
  mobileNav.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}

menuButton?.addEventListener("click", () => {
  const opens = mobileNav.hidden;
  mobileNav.hidden = !opens;
  menuButton.setAttribute("aria-expanded", String(opens));
  document.body.classList.toggle("menu-open", opens);
});

// Si la pantalla vuelve a escritorio, el menú móvil no conserva un estado abierto.
window.addEventListener("resize", () => {
  if (window.innerWidth > 860) closeMenu();
});

// La delegación permite controlar enlaces de sesión y del menú desde un solo evento.
document.addEventListener("click", async event => {
  const logoutLink = event.target.closest("[data-logout]");
  if (logoutLink) {
    event.preventDefault();
    const accepted = await askDecision({ title: "¿Cerrar sesión?", text: "Podés volver a ingresar cuando quieras.", confirmText: "Cerrar sesión" });
    if (accepted) {
      logoutUser();
      notify("Sesión cerrada.", "info");
      window.setTimeout(() => { location.href = "./index.html"; }, 450);
    }
    return;
  }
  if (event.target.closest("#mobileNav a")) closeMenu();
});

updateSessionLinks();
