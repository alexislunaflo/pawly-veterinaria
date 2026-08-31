# Pawly · Proyecto final JavaScript

Pawly es un simulador multipágina de gestión veterinaria desarrollado con HTML, CSS y JavaScript. Permite conocer veterinarias, especialidades, precios y profesionales; crear perfiles de mascotas; registrar recordatorios sanitarios; reservar según disponibilidad; y consultar, reprogramar o cancelar turnos.

## Cómo ejecutarlo

Los catálogos se cargan mediante `fetch`, por lo que el proyecto necesita un servidor local. No debe abrirse `index.html` directamente desde el explorador de archivos.

Opciones:

1. Abrir la carpeta en Visual Studio Code y ejecutar **Live Server** sobre `index.html`.
2. Ejecutar `py -m http.server 5500` en esta carpeta y visitar `http://localhost:5500`.

No es necesario instalar dependencias.

## Cómo compartirlo

### Con un enlace público

Como Pawly es un sitio estático, puede publicarse sin backend:

- **GitHub Pages:** subir todos los archivos a un repositorio, abrir `Settings → Pages`, elegir `Deploy from a branch` y publicar la rama `main` desde la carpeta raíz.
- **Netlify:** usar el despliegue manual y arrastrar la carpeta completa del proyecto a la zona de publicación.

En ambos casos debe conservarse la estructura de carpetas y `index.html` debe permanecer en la raíz.

### Como archivo comprimido

También se puede enviar la carpeta como `.zip`. Quien la reciba deberá descomprimirla y abrirla con Live Server o ejecutar `py -m http.server 5500`, ya que los archivos JSON se cargan mediante `fetch`.

## Páginas

- `index.html`: bienvenida e información general.
- `veterinarias.html`: sedes agrupadas por zona, selector, buscador y acceso directo a reserva.
- `especialidades.html`: tipos de atención, duración y valor orientativo.
- `profesionales.html`: equipo con filtros combinables por zona, sede y especialidad.
- `login.html`: inicio de sesión.
- `registro.html`: creación de usuario.
- `recuperar.html`: recuperación simulada de contraseña mediante un código temporal.
- `mascotas.html`: perfiles, historial y recordatorios de vacunas y desparasitación.
- `reservar.html`: reserva guiada por zona y sede, selección de mascota, presupuesto y recordatorio.
- `turnos.html`: agenda personal, cancelación y reprogramación.

## Requisitos de la consigna

| Requisito | Implementación |
| --- | --- |
| DOM y eventos | Catálogos, filtros, perfiles de mascotas, recordatorios, horarios, presupuesto, historial y agenda se generan y actualizan desde JavaScript. |
| Arrays en JSON | Veterinarias, especialidades con precios y profesionales están en `data/*.json` y se solicitan mediante `fetch`. Los usuarios, mascotas y turnos son información generada durante el uso y se serializan en `localStorage`. |
| Circuito completo | Registro o ingreso → perfil de mascota → servicio y precio → profesional → fecha y paciente → presupuesto → confirmación → historial y administración. |
| Librería externa | SweetAlert2 muestra notificaciones y confirmaciones. |
| Sin cuadros nativos | No se utilizan `prompt`, `alert` ni `confirm`. |
| Sin consola | No hay mensajes ni resultados enviados a la consola. |
| Código claro | La lógica se divide en módulos por responsabilidad y reutiliza un núcleo compartido. |

## Estructura principal

```text
.
├── index.html
├── veterinarias.html
├── especialidades.html
├── profesionales.html
├── login.html
├── registro.html
├── recuperar.html
├── mascotas.html
├── reservar.html
├── turnos.html
├── styles.css
├── favicon.svg
├── data/
│   ├── veterinarias.json
│   ├── especialidades.json
│   └── profesionales.json
└── js/
    ├── core.js
    ├── layout.js
    ├── catalogs.js
    ├── auth.js
    ├── recovery.js
    ├── pets.js
    ├── booking.js
    └── appointments.js
```

## Nota académica

La autenticación simula un sistema real dentro del alcance del curso. Las contraseñas se transforman antes de guardarse, pero una aplicación de producción debe manejar cuentas, sesiones, mascotas y turnos desde un backend seguro y una base de datos.
