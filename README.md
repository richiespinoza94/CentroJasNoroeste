# Centro JAS · La Velada

App de registro, recepción y asignación de mesas para "La Velada", la cena
formal del Centro JAS Noroeste. React (Vite) + Firestore en tiempo real,
implementada a partir del prototipo diseñado en Claude Design
(`Centro JAS - La Velada.dc.html`).

## Categoría estandarizada (Miembro / Invitado / Líder / Staff)

Antes había dos campos parcialmente superpuestos: "tipo" (Miembro/Invitado)
en el formulario y una "categoría de mesa" (participante/programa/staff)
separada, más un tercer vocabulario en `reservedFor` de las mesas. Ahora es
**un solo campo `categoria`**, mismo valor en todos lados:

- **Formulario público**: solo puede elegir `Miembro` o `Invitado` — nadie
  se autodeclara Líder o Staff desde su teléfono (`firestore.rules` lo
  bloquea también del lado del servidor, no solo en la UI).
- **Registro manual** (recepción): puede elegir cualquiera de las 4 —
  `Miembro`, `Invitado`, `Líder`, `Staff` — porque lo hace un staff
  autenticado, es un registro mediado.
- **Mesas reservadas**: el `reservedFor` de una mesa usa el mismo
  vocabulario (`Líder`, `Staff`, `Invitado`) y se compara directo contra la
  `categoria` de la persona — sin tabla de traducción intermedia.

> ⚠️ **Si ya tenías datos cargados con el esquema viejo** (`categoria:
> 'participante'/'programa'/'staff'` o una mesa `reservedFor: 'programa'`),
> hay que migrarlos a mano antes de desplegar esta versión — de lo
> contrario esas personas/mesas dejan de matchear con la lógica de
> recomendación (quedan sin categoría reconocida). Es un vistazo rápido en
> la consola de Firestore dado el volumen esperado del evento; avisame si
> querés que te arme un script de migración en vez de hacerlo a mano.

## Perfiles / pantallas

| Perfil | Pantalla | Ruta en la app |
|---|---|---|
| Asistente (público) | Formulario de registro + confirmación con código | `Formulario` en el nav |
| Staff (recepción) | Buscar/check-in, vista de mesas, registro manual, dashboard (con avance por estaca/barrio y deshacer rápido) | Login → `Recepción` |
| Admin | Dashboard, distribución por estaca/barrio, config. de mesas, usuarios | Login (rol admin) → `Admin` |

## Setup del proyecto Firebase (una sola vez)

Proyecto: [`centro-jas-noroeste`](https://console.firebase.google.com/u/0/project/centro-jas-noroeste/firestore).

1. **Habilitar Firestore** — Console → Firestore Database → Crear base de
   datos (modo producción, la región no importa demasiado para este
   volumen; `southamerica-east1` o `us-central1` están bien).
2. **Habilitar el método de acceso Email/Password** — Console →
   Authentication → Sign-in method → habilitar "Correo electrónico y
   contraseña". El login sigue siendo por usuario + PIN de 4 dígitos desde
   la app; por dentro se apoya en Firebase Auth para que las reglas de
   seguridad puedan verificar de verdad quién es admin/recepción (ver
   sección "Cómo funciona el login" más abajo).
3. **Copiar la config del SDK web** — Console → Project settings → General
   → Your apps → agregar app web si no existe → copiar los valores a
   `.env.local` (usa `.env.example` como plantilla). Estos valores no son
   secretos, están pensados para ir en el bundle del navegador.
4. **Descargar una service account key** (solo para el script de seed) —
   Console → Project settings → Service accounts → Generate new private
   key → guardar como `serviceAccountKey.json` en la raíz del proyecto
   (ya está en `.gitignore`, nunca se sube).
5. **Instalar el Firebase CLI y desplegar las reglas**:
   ```bash
   npm install -g firebase-tools   # o usa npx en cada comando
   firebase login
   firebase deploy --only firestore:rules --project centro-jas-noroeste
   ```
6. **Sembrar las mesas y el admin inicial**:
   ```bash
   npm run seed
   ```
   Crea las 9 mesas por defecto (respeta las que ya existan, no las
   pisa) y un usuario `admin` con PIN `1234` si todavía no hay ninguno con
   ese username — **cambia ese PIN apenas inicies sesión la primera vez**
   (aún no hay UI para cambiar el propio PIN; queda como pendiente, ver
   abajo). Personalizable vía `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PIN` en
   `.env.local`.

## Correr localmente

```bash
npm install
npm run dev       # contra Firestore real (necesita .env.local completo)
npm run build     # build de producción a dist/
npm run check     # self-check de validación + algoritmo de mesas (sin red)
```

### Contra el emulador local, sin tocar datos reales

```bash
npm run emulators        # Firestore + Auth emulator, otra terminal
npm run dev:emulator      # la app se conecta al emulador en vez de producción
```
Necesita `firebase-tools` (`npx firebase-tools` si no está instalado
globalmente) y Java (para el emulador de Firestore). El seed también
funciona contra el emulador si exportas `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
y `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` antes de correrlo.

## Desplegar en Vercel

1. Importa el repo en Vercel, rama `claude/centro-jas-code-generation-p4k9ha`
   (o la que corresponda una vez mergeado a `main`).
2. Vercel detecta Vite automáticamente (`npm run build`, output `dist`).
3. Agrega las mismas variables de `.env.local` en Project Settings →
   Environment Variables (los `VITE_FIREBASE_*`).
4. Deploy. Cada push a la rama conectada vuelve a desplegar solo.

## Arquitectura

```
src/
  domain/          lógica de negocio pura (validación, recomendación de
                    mesas, estadísticas) — sin React ni Firebase, fácil de
                    testear (scripts/self-check.mjs) y de mover a Cloud
                    Functions si algún día hace falta.
  firebase/
    config.js       inicializa Firebase (o el emulador local)
    auth.js          login por usuario+PIN sobre Firebase Auth
    collections.js   lecturas en tiempo real + escrituras/transacciones
                      de participants y tables
    AuthProvider.jsx  contexto: quién está logueado y con qué rol
    DataProvider.jsx  contexto: participants/tables en tiempo real
  state/store.jsx   estado *local* de UI (borradores de formulario, tab
                    activo, pasos de login) — nunca datos compartidos
  components/       un directorio por pantalla (PublicForm, Login,
                    Reception, Admin) + shared/ y ui/
```

## Cómo funciona el login (usuario + PIN sobre Firebase Auth)

El PIN de 4 dígitos nunca toca Firestore. `username` se convierte en un
correo sintético (`fiorella@login.centrojasnoroeste.app`) y el PIN se
rellena para cumplir el mínimo de 6 caracteres de Firebase Auth
(`cjn-1234-pin`) — el relleno es solo un ajuste de longitud, la
verificación real la hace Firebase, no el cliente.

Flujo de creación de cuenta:
1. Un admin reserva `username` + `role` en `pendingStaff/{username}`
   (público de solo lectura, así el login puede distinguir "no existe" de
   "existe pero sin PIN" sin necesitar sesión).
2. La primera vez que esa persona entra, la app crea la cuenta de Firebase
   Auth y, en un batch, el perfil real `staff/{uid}` — con el **rol tomado
   de `pendingStaff`, no de lo que mande el cliente** (`firestore.rules`
   lo valida con un `get()`), así nadie puede auto-asignarse admin.
3. `usernames/{username} → {uid}` queda como puntero para logins
   posteriores.

Eliminar un usuario desde Admin borra su perfil de Firestore (pierde acceso
a la app y a todo lo que las reglas protegen), pero la cuenta de Firebase
Auth en sí no se puede borrar desde el cliente — necesitaría el Admin SDK
o una Cloud Function. Para este caso de uso (un evento, roles de bajo
riesgo) no se justificó agregar esa pieza extra.

## Concurrencia: por qué esto necesitaba Firestore

El requisito no negociable del PRD (§16) es que una mesa nunca supere su
capacidad aunque dos dispositivos de recepción asignen al mismo tiempo. Se
verificó en vivo contra el emulador: dos asignaciones concurrentes a una
mesa de 1 asiento — exactamente una gana, la otra recibe "ya está
completa", y el contador nunca pasa de 1. `tables/{id}.occ` es un contador
desnormalizado que se actualiza dentro de la misma transacción que mueve al
participante (`firebase/collections.js:assignTable`), así que el chequeo de
capacidad es una lectura de un solo documento, no un scan.

## Qué se dejó fuera a propósito

- **Cambiar el propio PIN / recuperarlo** — no hay UI para esto todavía.
  El admin inicial debe cambiar su PIN eliminando y recreando su usuario,
  o pídeme que agregue una pantalla de "cambiar PIN" cuando haga falta.
- **Borrar la cuenta de Firebase Auth al eliminar un usuario** — ver
  arriba, necesita Admin SDK/Cloud Function.
- **Code-splitting del bundle de Firebase** (~670 KB sin comprimir, ~173 KB
  gzip) — el build avisa que el chunk es grande. Separar `firebase/auth` en
  un `import()` dinámico para que el formulario público no lo cargue
  ayudaría a "cargas iniciales rápidas" (PRD §15), pero no es necesario
  para que funcione. Se puede agregar si el tiempo de carga en el
  formulario público resulta ser un problema real.
- **Colección `events`** para nombre/fecha/ubicación configurables desde
  Admin (PRD §24) — hoy siguen siendo una constante en
  `src/domain/constants.js`. El PRD lo marca como algo que "puede
  adaptarse durante la implementación", no como parte del MVP.
