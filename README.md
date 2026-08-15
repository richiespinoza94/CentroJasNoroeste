# Centro JAS · La Velada

App de registro, recepción y asignación de mesas para "La Velada", la cena
formal del Centro JAS Noroeste. Implementación en React (Vite) del prototipo
diseñado en Claude Design (`Centro JAS - La Velada.dc.html`), con mejoras de
UX/accesibilidad aplicadas por perfil.

## Perfiles / pantallas

| Perfil | Pantalla | Ruta en la app |
|---|---|---|
| Asistente (público) | Formulario de registro + confirmación con código | `Formulario` en el nav |
| Staff (recepción) | Buscar/check-in, vista de mesas, registro manual, dashboard | Login → `Recepción` |
| Admin | Dashboard, distribución por estaca/barrio, config. de mesas, usuarios | Login (rol admin) → `Admin` |

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de producción a dist/
npm run check    # self-check de la lógica de validación y recomendación de mesas
```

Usuarios de prueba (seed): `admin` (PIN `1234`, rol admin), `fiorella` y
`renzo` (rol recepción, sin PIN — el primer login les pide crear uno).

## Arquitectura

```
src/
  domain/        lógica de negocio pura (validación, recomendación de mesas,
                  estadísticas) — sin React, fácil de testear y de mover a
                  Cloud Functions más adelante si hace falta.
  state/store.jsx estado global (useReducer + Context). Reemplaza 1:1 la
                  clase Component del prototipo, con persistencia en
                  localStorage para no perder registros al recargar.
  components/     un directorio por pantalla (PublicForm, Login, Reception,
                  Admin) + shared/ y ui/ para lo reutilizado entre pantallas.
```

Separación deliberada por PRD §18: la UI nunca calcula reglas de negocio
directamente, siempre pasa por `domain/`. Esto es lo que permite enchufar
Firestore después tocando un solo archivo (`state/store.jsx`) sin rehacer
componentes.

## Diagnóstico UX aplicado (ui-ux-pro-max + frontend-design)

Cambios concretos sobre el prototipo, por qué importan y dónde viven:

- **Accesibilidad de formularios** — labels reales (`<label htmlFor>`) en vez
  de `<span>` decorativo, errores con `role="alert"`/`aria-describedby`, y
  foco automático al primer campo inválido tras un submit fallido
  (`RegistrationForm.jsx`).
- **Touch targets ≥44px** en inputs, botones y tabs — el prototipo original
  tenía varios controles por debajo del mínimo táctil (`tokens.css`,
  `--touch-min`).
- **Feedback inmediato tras cada acción** (PRD §14 lo pide explícitamente) —
  toasts al hacer check-in, asignar/liberar mesa, registrar manualmente o
  crear mesa/usuario (`hooks/useToast.jsx`).
- **Confirmación antes de acciones destructivas** — eliminar una mesa o un
  usuario ahora pide confirmación nativa; el prototipo lo ejecutaba al
  instante (`Admin/TablesConfig.jsx`, `Admin/UsersConfig.jsx`).
- **Sin bezel de iPhone falso en producción** — el prototipo envolvía el
  formulario público en `ios-frame.jsx` (un mockup de dispositivo para
  previsualizar en el canvas de diseño). En producción el teléfono real del
  asistente ya provee ese marco; se implementó como una página responsive
  normal, mobile-first (`PublicForm/PublicScreen.jsx`).
- **`prefers-reduced-motion` y foco visible siempre** — ninguna animación
  añadida (toasts, press states) ignora la preferencia de movimiento
  reducido, y el anillo de foco nunca se desactiva (`tokens.css`).
- **Cifras tabulares** (`font-variant-numeric: tabular-nums`) en stat cards
  y códigos de confirmación para que no salten al actualizarse.
- **Persistencia local** — los registros ya no se pierden al refrescar la
  pantalla de recepción (localStorage), algo crítico dado que el PRD asume
  el uso continuo del dispositivo durante el evento.

## Qué falta para producción (fuera de este alcance)

Backend real. Esta versión usa `localStorage` como stand-in de Firestore —
suficiente para demostrar y probar el flujo completo, pero no resuelve
concurrencia entre varios dispositivos de recepción (PRD §16). Cuando haya
credenciales de Firebase, el reemplazo es acotado: `state/store.jsx` pasa de
`useReducer` a listeners de Firestore + transacciones para `ASSIGN_TABLE`;
nada en `domain/` ni en los componentes necesita cambiar.
