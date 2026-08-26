# Centro JAS Noroeste — Plataforma de gestión de actividades

> Documento de referencia completo del proyecto. Escrito para que **cualquier
> agente de IA pueda regenerar esta aplicación desde cero** con el mismo
> criterio, arquitectura y decisiones de diseño que se tomaron aquí — no solo
> el código, sino el *por qué* de cada decisión. Si estás leyendo esto para
> reconstruir el proyecto: lee primero la sección "Principios y forma de
> trabajar" — es más importante que cualquier detalle técnico individual.

---

## 1. Objetivo del proyecto

**Qué es:** una plataforma web (React + Firebase) para que el **Centro JAS
Noroeste** — una organización de jóvenes adultos solteros que abarca tres
estacas (**Ventanilla, Miramar, Puente Piedra**) — gestione el registro y
asistencia a sus actividades (retiros, full days, noches de hogar, etc.).

**De dónde viene:** el proyecto empezó como una app de un solo evento ("La
Velada") y se generalizó a una plataforma multi-actividad. Esa historia
importa porque explica por qué el modelo de datos separa "quién es la
persona" (`personas`) de "en qué actividad participó" (`inscripciones`) — no
siempre fue así; al principio era una sola colección plana por evento.

**Qué resuelve, en la práctica:**
- El staff crea actividades desde la propia app (nada hardcodeado).
- El público se registra desde un formulario por QR, sin crear una cuenta.
- Una misma persona que participa en varias actividades a lo largo de los
  años queda como **una sola identidad**, no un registro nuevo por evento.
- Recepción confirma asistencia en el momento, sin depender de admin.
- Admin ve historial, tendencia de asistencia entre actividades, y descarga
  reportes en Excel.
- Cada actividad tiene su propio QR — para mostrar en pantalla, compartir a
  redes sociales, o descargar como afiche.

---

## 2. Principios y forma de trabajar (léase antes que nada)

Esto es lo que más vale la pena preservar si se regenera el proyecto — más
que cualquier componente puntual.

### 2.1 Skills que se consultan, y cuándo

- **`ponytail`** — antes de cualquier decisión de arquitectura o de agregar
  una dependencia. Pregunta: "¿esto necesita existir? ¿hay una forma más
  simple con lo que el navegador/la plataforma ya da?". Ejemplos reales de
  este proyecto: usar la Font Loading API nativa en vez de una librería,
  generar imágenes con `<canvas>` en vez de una librería de PDF, usar
  `Map`/`Set` nativos en vez de una librería de búsqueda.
- **`ux-ui-pro-max`** — antes de construir cualquier pantalla o componente
  nuevo. Cubre: objetivos táctiles mínimos de 44px, validación en el
  momento correcto (al salir del campo, no tecla por tecla), mensajes de
  error que dicen la causa y cómo corregirla, estados vacíos explícitos,
  gráficos con etiquetas directas y resumen accesible.
- **`frontend-design`** — para decisiones visuales. Con matiz importante:
  este proyecto **no** es un lienzo en blanco — ya tiene una identidad de
  marca establecida (navy + dorado, Nunito/Lato). La skill se aplica como
  "cohesión con lo existente", no como licencia para reinventar la estética
  en cada pantalla nueva.
- **`vercel-react-best-practices`** — antes de decisiones de arquitectura de
  React/rendimiento. Reglas que de verdad importaron aquí: `bundle-conditional`
  (code-splitting por pantalla), `rerender-dependencies` (depender de
  primitivos, no de objetos que Firestore recrea en cada snapshot),
  `rendering-svg-precision` (redondear coordenadas de SVG).
- **`vercel-composition-patterns`** — antes de decisiones de arquitectura de
  componentes. La regla que más se aplicó: extraer un componente/hook
  compartido recién cuando hay **dos usos reales** (no antes, no "por si
  acaso") — así se extrajeron `ui/Modal.jsx` y `hooks/usePagination.js`.

### 2.2 Ponytail como filosofía general, no solo una skill puntual

- La solución más simple que funciona, no la más "completa".
- Antes de una librería nueva: ¿la plataforma ya lo puede hacer? (Web Share
  API en vez de una librería de compartir; `<canvas>` en vez de una
  librería de generación de imágenes; `BarcodeDetector` nativo en vez de
  una librería de escaneo, si algún día se necesita).
- Extraer código compartido recién cuando hay 2 usos reales, no antes.
- No construir clasificadores frágiles para texto libre humano (ver el caso
  del filtro de "no tengo alergia" — se intentó, no funcionó bien, se
  simplificó a guardar el texto tal cual).

### 2.3 Cómo se entregan los cambios (importante si se automatiza este flujo)

El dueño del proyecto trabaja en **Windows con PowerShell**, aplicando
parches (`git apply`) generados en un sandbox Linux. Lecciones aprendidas
de la manera difícil, documentadas para no repetirlas:

1. **PowerShell no usa `&&`** — cada comando en su propia línea, o con `;`.
2. **Siempre generar el patch desde un HEAD sincronizado con `origin/main`
   real** — no desde una copia local que quedó desactualizada. Pasó más de
   una vez que un patch se generó de forma acumulativa (incluyendo cambios
   que el usuario ya había aplicado y commiteado por su cuenta), lo que
   causaba que `git apply` fallara por completo — incluyendo los cambios
   nuevos que sí importaban. La rutina correcta: `git fetch origin`, `git
   reset --hard origin/main` (o `git stash` si hay trabajo local sin
   commitear), y **recién ahí** generar el diff.
3. **Verificar que el patch se aplicó de verdad**, no asumir. Pasó que
   `git apply` falló silenciosamente (un archivo del patch "ya existía en
   el directorio de trabajo" porque no se había commiteado en una corrida
   anterior) y el usuario terminó comiteando *solo el archivo `.patch`
   suelto*, sin ningún cambio de código real, sin darse cuenta hasta que
   preguntó "¿estás seguro que se aplicó?". La rutina correcta: después de
   `git apply`, correr `git status` y confirmar explícitamente que los
   archivos `.jsx`/`.css` aparecen como `modified` (no solo el `.patch`
   como archivo nuevo) — y comparar un número concreto y verificable (ej.
   el tamaño en KB de un chunk de build) contra lo esperado, no solo "el
   build no tiró error".
4. **Windows Terminal usa comillas para rutas con espacios** (`git apply
   "archivo con espacios.patch"`), y `<`/`>` están reservados — nunca pedir
   que el usuario pegue un placeholder literal como `<el-id>`, siempre
   dar el valor real o pedirle que lo copie de un resultado anterior.
5. **Cada patch se valida antes de entregarse**: `npm run check` (los tests
   de dominio) + `npm run build` (que compile) como mínimo. Para features
   con lógica de layout/texto que puede desbordar (afiches, tarjetas
   compartibles), además se probó con **datos reales extremos** (nombres
   larguísimos sin espacios, campos vacíos, textos al límite) usando
   `node-canvas` / `wkhtmltopdf` en el sandbox — no solo "se ve bien en un
   caso feliz".
6. **Nunca reescribir un string base64 a mano** — truncar/corromper
   imágenes grandes al reescribirlas fue un error real temprano en el
   proyecto. La regla: copiar el archivo original tal cual (`cp`), o
   generarlo con una herramienta (ImageMagick) directo desde el archivo
   fuente — nunca re-tipear el contenido.

### 2.4 Memoria y contexto entre sesiones

El dueño del proyecto espera que las decisiones de arquitectura persistan
entre conversaciones — por eso este documento existe. Instrucciones
explícitas que se acumularon durante el proyecto y que deberían seguir
aplicando:
- Consultar `ponytail`, `ux-ui-pro-max`, `frontend-design` antes de
  construir cualquier sección nueva de UI — sin excepción.
- Consultar `vercel-react-best-practices` / `vercel-composition-patterns`
  antes de decisiones de arquitectura.

---

## 3. Stack técnico

| Capa | Elección | Por qué |
|---|---|---|
| Framework | React 18 + Vite | SPA simple, sin necesidad de SSR — el contenido es todo dinámico/autenticado o detrás de un QR, no hay nada que se beneficie de SSR/SEO. |
| Datos | Firebase Firestore | Tiempo real ya integrado (`onSnapshot`), reglas de seguridad declarativas, encaja con "staff ve cambios de otro dispositivo al instante". |
| Auth | Firebase Auth (email/password sintético) | El PIN de 4 dígitos del staff nunca toca Firestore — se traduce a un par email/password sintético (`{username}@login.centrojasnoroeste.app` / `cjn-{pin}-pin`) y Firebase Auth lo verifica del lado de sus servidores. Firestore rules nunca ven el PIN. |
| Hosting | Vercel | Deploy automático al hacer push a `main`. |
| Fuentes | Nunito (display) + Lato (body), vía Google Fonts para la UI general, **empaquetadas localmente** (`@fontsource`) para lo que se dibuja en `<canvas>` o se imprime — ver §7.4. |

### Dependencias reales (`package.json`)

```json
"dependencies": {
  "@fontsource/lato": "^5.3.0",
  "@fontsource/nunito": "^5.3.0",
  "firebase": "^11.0.2",
  "qrcode": "^1.5.4",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "xlsx": "^0.18.5"
},
"devDependencies": {
  "@vitejs/plugin-react": "^4.3.4",
  "firebase-admin": "^13.0.1",
  "vite": "^5.4.11"
}
```

Nota deliberada: **no hay librería de gráficos, ni de generación de PDF, ni
de captura de DOM a imagen (`html2canvas`)**. Los gráficos son SVG a mano,
los afiches/tarjetas compartibles son `<canvas>` a mano, y "imprimir" es
"descargar una imagen y que el sistema operativo la imprima" — ver §7.4
para el por qué.

---

## 4. Modelo de datos (Firestore)

### 4.1 Colecciones activas

**`activities/{activityId}`** — una actividad del centro (Full Day, Noche
de Hogar, etc.). Exactamente **una** puede estar `activa: true` a la vez —
esa es la que ve el formulario público por defecto.
```
{ nombre, fecha, lugar, anfitrion, activa: boolean, createdAt }
```
Lectura pública (el formulario y el navbar la necesitan sin login),
escritura solo admin.

**`personas/{whatsapp}`** — identidad global de una persona, **compartida
entre todas las actividades**. El WhatsApp es el ID del documento a
propósito: así "¿ya existe esta persona?" es una operación atómica de
creación de documento, no una consulta con condición de carrera.
```
{ nombre, apellidos, sexo, fechaNacimiento, estaca, barrio, correo, createdAt, updatedAt }
```
Lectura por ID exacto pública (necesario para el chequeo de duplicados y
para autocompletar al confirmar "¿eres tú?" — ver §6.1); listado completo
solo staff.

**`inscripciones/{activityId}_{whatsapp}`** — la participación de una
persona en **una** actividad concreta. El ID compuesto hace que "¿ya se
inscribió en esta actividad?" también sea atómico, sin bloquear que la
misma persona se inscriba en una actividad *distinta*.
```
{ activityId, whatsapp, categoria, status, alergia?, sugerencia?, createdAt, updatedAt }
```
`categoria` ∈ `Miembro | Invitado | Líder | Staff` (el público solo puede
elegir los primeros dos — Líder/Staff se asigna a mano desde Recepción).
`status` ∈ `pendiente | presente`.

**`personas_publico/{whatsapp}`** — índice de **exposición mínima**, de
lectura pública, para el aviso "¿eres tú?" en el formulario. Contiene
**solo** `{ nombreCompleto, estaca }` — nunca WhatsApp como campo, nunca
correo, nunca fecha de nacimiento. El WhatsApp SÍ es el ID del documento
(decisión consciente costo/beneficio — ver §6.1, incluye la comparación de
alternativas que se descartaron).

**`staff/{uid}`**, **`pendingStaff/{username}`**, **`usernames/{username}`**
— autenticación del staff. Un admin "reserva" un username+rol antes de que
esa persona exista como usuario de Firebase Auth; cuando esa persona hace
login por primera vez, crea su propio perfil `staff/{uid}` pero el rol
queda bloqueado a lo que el admin reservó — un cliente nunca puede
autoasignarse `role: 'admin'`.

### 4.2 Colección deprecada, conservada como respaldo

**`participants/{whatsapp}`** — el modelo original de "un solo evento",
antes de separar `personas`/`inscripciones`. Ya no la usa la app; queda de
solo lectura para staff como respaldo histórico. Ver `scripts/migrate-personas-fase2.mjs`.

### 4.3 Por qué NO existe una colección de "mesas"/"grupos"

Existió (`tables`), se sacó del núcleo a propósito — es lógica específica
de eventos tipo cena (asignación de mesas por categoría, capacidad). Si se
necesita para un evento futuro, reconstruir como patch aparte, no como
parte del núcleo — así lo decidió el dueño del proyecto explícitamente.

---

## 5. Reglas de seguridad (`firestore.rules`) — resumen razonado

El patrón general: **"ID de documento conocido = lectura pública permitida,
listado completo = solo staff"**. Esto permite que el formulario público
haga chequeos puntuales (¿existe este WhatsApp?) sin poder enumerar a nadie.

```
personas/{whatsapp}:
  get: público (lookup exacto)     |  list: solo staff
  create/update: público con forma válida (whatsapp+nombre+apellidos) O staff
  delete: nunca

inscripciones/{activityId_whatsapp}:
  get: público                     |  list: solo staff
  create: público con forma válida (status=pendiente, categoria pública) O staff
  update: solo staff               |  delete: nunca

personas_publico/{whatsapp}:
  read: público
  create/update: público, con forma estrictamente {nombreCompleto, estaca}
  delete: nunca

activities/{id}:
  read: público                    |  write: solo admin

staff / pendingStaff / usernames:
  ver reglas completas — el punto clave es que el rol de un usuario nunca
  lo decide el propio cliente, siempre viene de lo que un admin reservó.
```

El PIN de staff **nunca** aparece en Firestore ni en las reglas — ver §3
(traducción a email/password sintético, verificado por Firebase Auth).

---

## 6. Flujos, a detalle

### 6.1 Formulario público de registro (`PublicForm/RegistrationForm.jsx`)

**Cómo llega la gente:** un QR (o link directo) con `?actividad=<id>` en la
URL. Ese parámetro **manda sobre** "la actividad activa ahora" — así un QR
impreso hoy sigue apuntando a la misma actividad aunque más adelante se
active otra. Sin el parámetro (visita directa a la app), se usa la
actividad marcada como activa.

**Identidad única — el problema que resuelve:** una persona que ya se
registró en una actividad anterior no debería tener que crear un "ID"
nuevo cada vez, y el sistema debería poder avisarle si detecta que ya
existe, sin exponer datos de contacto de nadie a quien no corresponda.

**Flujo completo:**
1. La persona escribe nombre + apellidos.
2. En cuanto el nombre completo normalizado llega a 6+ caracteres, se pide
   (por primera vez, no en cada tecla) el índice `personas_publico` — con
   **carga diferida**: no se pide apenas se monta el formulario, para no
   competir por ancho de banda con la fuente/el logo/el JS en el arranque
   en frío (ver §8, hallazgo de performance).
3. Si hay una coincidencia por nombre completo exacto (normalizado, sin
   acentos/mayúsculas), aparece un aviso: *"👋 Ya vimos a alguien parecido:
   [Nombre] ([Estaca]). ¿Eres tú?"* con dos botones — **nunca autocompleta
   sin confirmación explícita, nunca bloquea el envío**.
4. Si toca **"Sí, soy yo"**: se trae el documento completo de esa persona
   (lectura por ID exacto, ya permitida por las reglas — no hace falta
   abrir ningún permiso nuevo) y se autocompletan **todos** los campos
   disponibles (fecha de nacimiento, sexo, estaca, barrio, correo). El
   campo WhatsApp queda **bloqueado y enmascarado** (`99•••••55` — se ven
   los primeros y últimos 2 dígitos) para que alguien que escriba nombres
   al azar no pueda "pescar" el número real de otra persona con solo
   confirmar el match. Hay un botón "¿No eras tú? Empezar de nuevo" que
   resetea el formulario completo por si alguien confirmó por error.
5. Si toca **"No, es otra persona"**: se descarta el aviso, sigue con su
   propio número (el campo queda editable normalmente).
6. Al enviar: una **transacción atómica** hace dos cosas — crea/actualiza
   `personas/{whatsapp}` (upsert, nunca pisa datos ya existentes con datos
   más viejos si el WhatsApp coincide con alguien que ya estaba), y crea
   `inscripciones/{activityId}_{whatsapp}` (falla si ya existe esa
   combinación exacta → mensaje "Ya estás registrado(a) para '[actividad]'").
7. En paralelo (sin bloquear el envío), se escribe/actualiza el espejo en
   `personas_publico` — así la próxima persona que escriba un nombre
   parecido puede ser avisada.

**Validación anti-fake** (`domain/validation.js`) — portada y verificada
contra 311 registros reales del Full Day antes de integrarla (cero falsos
positivos):
- Nombre/apellidos: rechaza teclado mal aplastado, muy pocas vocales para
  su longitud, racha larga de consonantes, alternancia rara de mayúsculas.
- Correo: 40+ palabras sospechosas (`test`, `asdf`, `temporal`...),
  caracteres repetidos, demasiados números seguidos.
- WhatsApp: rechaza patrones obviamente falsos (todo el mismo dígito,
  alternancia, un par de dígitos repetido).
- **Estas reglas solo se aplican al formulario público**, no al registro
  manual que hace el staff en Recepción (ahí se confía en quien escribe).

**Diseño visual:** header con degradado navy (mismos tokens que el resto
de la app, nada de colores nuevos), logo circular real, badge dorado con
fecha/lugar, barra de progreso, secciones con título + barrita dorada
("¿Quién eres?" / "¿Cómo te contactamos?" / "¿De dónde eres?").

### 6.2 Recepción (`Reception/ReceptionScreen.jsx`)

Tres pestañas: **Buscar**, **Registro manual**, **Dashboard**. Además, una
barra con el nombre de la actividad activa + botón **QR** (mismo modal
compartido que usa Admin — ver §6.5).

- **Buscar** (`SearchTab.jsx`): lista de inscritos a la actividad activa,
  buscador por nombre/WhatsApp, selecciona una persona → confirma
  asistencia (`pendiente → presente`) o la deshace, y puede corregir su
  categoría (Miembro/Invitado/Líder/Staff) ahí mismo.
- **Registro manual** (`ManualTab.jsx`): para quien llega sin haberse
  registrado antes — mismo modelo de datos, categoría inicial elegible
  (incluye Líder/Staff, a diferencia del formulario público).
- **Dashboard**: `StatCards` + `DistributionBars` (por estaca y por
  barrio) de la actividad activa — mismos componentes que usa Admin.
- **`RecentActivity.jsx`**: los últimos check-ins, con un botón de
  deshacer rápido para el error más común (confirmar a la persona
  equivocada).

### 6.3 Admin (`Admin/AdminScreen.jsx`)

Cinco pestañas:

1. **Actividades** (`ActivitiesConfig.jsx`) — crear/editar actividades,
   marcar cuál está activa (exactamente una a la vez, transacción atómica
   que desactiva la anterior), y el botón **QR** por fila.
2. **Dashboard** — stats + distribución de la actividad activa, botón para
   descargar el reporte Excel completo.
3. **Historial** (`ActivityHistory.jsx`) — navega entre **todas** las
   actividades (activas o no) con chips, ve stats/asistentes/reporte de
   cada una, **gráfico de tendencia de asistencia** (SVG a mano, sin
   librería) comparando registrados vs. presentes entre actividades
   ordenadas por fecha, lista de asistentes **paginada de 15** con filtro
   por categoría.
4. **Personas** (`PersonasConfig.jsx`) — directorio global (todas las
   actividades juntas), buscador inteligente, paginado de 15, cada fila
   editable en un modal (nombre, apellidos, sexo, fecha, estaca, barrio,
   correo, y el rol en la actividad activa si tiene inscripción ahí).
5. **Usuarios** (`UsersConfig.jsx`) — gestión de staff (reservar
   usuario+rol, ver quién ya activó su cuenta).

### 6.4 Buscador inteligente (patrón reusado en 3 lugares)

Mismo algoritmo en `Admin → Personas`, la fusión de identidad del
formulario público, y heredado conceptualmente del `checkin.html` del
proyecto hermano "Full Day": normaliza acentos/mayúsculas, compara por
prefijo/substring, puntúa coincidencias exactas más alto que parciales.
100% cliente — sin motor de búsqueda externo, el volumen de datos de un
centro JAS no lo justifica (ponytail).

### 6.5 QR por actividad (`shared/ActivityQRModal.jsx`)

Vive en `shared/` (no en `Admin/`) porque tanto Admin como Recepción lo
usan — Vite lo empaqueta automáticamente en su propio chunk compartido, sin
configuración manual.

El QR codifica `{origin}{pathname}?actividad={id}` — apunta siempre a esa
actividad específica, nunca a "lo que esté activo en ese momento" (así un
QR impreso sigue funcionando igual aunque se active otra actividad después).

Cuatro acciones, todas ya probadas con datos reales extremos:

1. **Ver el QR** en el modal (`qrcode`, generado on-demand, cargado con
   `import('qrcode')` para no inflar el bundle principal).
2. **Pantalla completa** — vista dedicada propia, **no** la Fullscreen API
   nativa del navegador (no funciona en Safari de iOS, justo la plataforma
   donde alguien sostendría el celular en alto para que otros escaneen).
3. **Compartir** — Web Share API nativa (abre el selector del sistema:
   WhatsApp, Instagram, Facebook, TikTok). Genera una tarjeta cuadrada
   1080×1080 dibujada en `<canvas>` (`domain/shareCard.js`, función
   `drawShareCard`). Si el navegador no soporta compartir archivos, cae a
   descarga directa con aviso claro.
4. **Descargar afiche** — imagen A4 (1240×1754) dibujada en `<canvas>`
   (`drawPrintFlyer`, mismo archivo). **Importante: no es HTML+CSS
   impreso.** La primera versión sí lo era (`window.print()` sobre una
   página con `print-color-adjust:exact`), pero Android "Guardar como PDF"
   no respeta ese CSS de forma confiable — el fondo navy/dorado
   desaparecía y quedaba blanco. La solución fue rasterizar los colores
   directo en los píxeles de una imagen — nada que ningún sistema pueda
   "no respetar".

**Ambas funciones de canvas comparten la misma disciplina de robustez**
(ver `domain/shareCard.js`):
- El **footer se mide primero**, el QR se lleva el espacio que sobra —
  nunca al revés. Esto es lo que evita que un nombre de actividad larguísimo
  empuje el QR fuera del lienzo.
- El título se ajusta a máximo 2 líneas, con elipsis si no cabe.
- El ajuste de texto **rompe también dentro de una palabra** si hace falta
  (una URL pegada sin espacios no debe poder salirse del ancho).
- Las fuentes (Nunito 800/900, Lato 400) se registran explícitamente vía
  `FontFace` API desde los archivos empaquetados (`@fontsource`) — nunca
  se asume que la fuente ya está cargada por el resto de la app (el peso
  900 en particular no lo carga nadie más).

### 6.6 Instalable como app (PWA)

`manifest.json` + service worker mínimo (sin caché — la app depende de
datos en tiempo real de Firestore, cachear agresivamente arriesgaría
mostrar una versión vieja sin que nadie se dé cuenta). Ícono maskable
verificado contra el peor caso de recorte de Android (círculo) antes de
integrarlo — el texto del logo no queda cortado. En iOS, sin prompt
automático (limitación de la plataforma, no de la app) — se agregan los
meta tags para que al menos el ícono/título salgan bien al hacer "Agregar
a pantalla de inicio" a mano.

---

## 7. Diseño — sistema completo

### 7.1 Paleta

```css
--navy-900: #14284f;   /* fondos oscuros, degradados */
--navy-800: #1a3a6b;   /* color de marca principal, texto sobre claro */
--navy-700: #234a86;   /* degradados */
--navy-100: #e7ecf5;   /* fondos tintados suaves (inputs, tarjetas) */
--gold-500: #f5a623;   /* acento, CTAs, badges */
--gold-700: #b45309;
--cream-50: #eef1f5;   /* fondo general de la app */
--white:    #ffffff;
--ink-900/700/500/300/200;  /* escala de texto, más oscuro = más énfasis */
--line-200/100;         /* bordes */
--panel-50;              /* fondo de tarjetas/filas secundarias */
--success-bg/fg/500, --warn-bg/fg, --danger-500/600;
```

### 7.2 Tipografía

- **Nunito** (`--font-display`) — títulos, badges, botones, cualquier cosa
  que necesite peso visual. Pesos usados: 600/700/800 en la UI general vía
  Google Fonts; **900** solo en lo que se dibuja en `<canvas>`, cargado
  aparte (ver §6.5).
- **Lato** (`--font-body`) — texto de cuerpo, inputs, párrafos.

### 7.3 Espaciado, radios, sombras, movimiento

```css
--space-1..8: 4px → 32px (escala de 4px)
--radius-sm: 8px, --radius-md: 10px, --radius-lg: 14px, --radius-pill: 999px
--shadow-card, --shadow-pop
--touch-min: 44px          /* objetivo táctil mínimo, sin excepciones */
--motion-fast: 150ms, --motion-base: 220ms, --ease-out: cubic-bezier(0.16, 1, 0.3, 1)
```

`prefers-reduced-motion` respetado globalmente (ver `tokens.css`).

### 7.4 Por qué el logo/afiches NO usan `html2canvas` ni una librería de PDF

Decisión de arquitectura repetida varias veces en el proyecto, vale la
pena explicarla una sola vez bien: cuando se necesitó generar una imagen
compartible y un afiche imprimible, la opción "fácil" habría sido
`html2canvas` (capturar el DOM tal cual se ve) o una librería de PDF
(`jsPDF`, etc.). Se descartaron ambas:
- `html2canvas` es pesado, no siempre captura gradientes/sombras CSS con
  fidelidad, y depende de que las fuentes ya estén aplicadas al DOM en el
  momento exacto de la captura.
- Una librería de PDF agrega peso al bundle para algo que un
  `<canvas>` + `toBlob()` ya resuelve con el navegador nativo.

En vez de eso: **dibujar directamente en `<canvas>` con la API 2D nativa**
(gradientes, `roundRect`, `drawImage`, `fillText` con ajuste de texto
manual). Es más código, pero es 100% predecible, no depende de que el
navegador "capture bien" nada, y el resultado es una imagen — que
funciona igual en cualquier plataforma, sin las inconsistencias de
imprimir HTML+CSS por el sistema operativo (ver el caso concreto de
Android en §6.5).

### 7.5 Patrones de componentes reusables

- **`ui/Modal.jsx`** — modal de hoja/tarjeta genérico: anima entrada/salida
  (nunca aparece de golpe), atrapa el foco con Tab, cierra con
  Escape/click-afuera, bloquea el scroll de fondo, devuelve el foco al
  elemento que lo abrió. Expone la función de cerrar vía **Context**
  (`useModalClose()`), no como render-prop — así cualquier botón anidado
  puede cerrar el modal sin que se lo pasen a mano por props.
- **`ui/Field.jsx`** — envoltorio de campo de formulario (label + control +
  mensaje de error), usa children-as-render-prop **a propósito** (necesita
  devolver props de accesibilidad al input/select que decida renderizar
  cada llamador — ese es el caso legítimo de usar render props según
  `vercel-composition-patterns`, a diferencia de `Modal`).
- **`hooks/usePagination.js`** — paginado de 15 por página, cliente. No
  resetea la página sola cuando cambian los datos de fondo — es
  responsabilidad de quien filtra llamar `setPage(0)`.
- **`shared/StatCards.jsx`**, **`shared/DistributionBars.jsx`** — usados
  tanto por Admin como por Recepción.

---

## 8. Performance — decisiones y hallazgos concretos

Auditado explícitamente más de una vez con `vercel-react-best-practices`.
Hallazgos reales, no genéricos:

1. **Code-splitting por pantalla** (`React.lazy` en `App.jsx`): Login,
   Recepción y Admin se cargan bajo demanda. Un visitante público que solo
   llena el formulario nunca descarga el código de esas tres pantallas, ni
   `xlsx` (283KB), ni `qrcode` (24KB), ni el modal de QR — todos son chunks
   separados.
2. **Lectura diferida en el formulario público**: `personas_publico` (el
   índice para "¿eres tú?") se pedía apenas se montaba el formulario,
   compitiendo por ancho de banda con la fuente/el logo/el JS. Ahora se
   pide recién cuando la persona ya escribió 6+ caracteres de nombre —
   saca esa lectura del camino crítico sin cambiar cuántas lecturas hace
   quien sí llena el formulario.
3. **Caché a nivel de módulo en Historial**: `AdminScreen` desmonta cada
   pestaña al cambiar (`{tab === X && <Componente/>}`), lo que repetía la
   lectura completa de `inscripciones` cada vez que se volvía a Historial.
   Se cacheó fuera del ciclo de vida del componente + botón de actualizar
   manual.
4. **`rerender-dependencies` real**: un `useEffect` en `DataProvider`
   dependía del *objeto* `activeActivity` completo — Firestore entrega una
   referencia nueva de ese objeto en cada cambio a **cualquier** actividad,
   no solo la activa. Se cambió a depender del `.id` (primitivo).
5. **Precisión de SVG**: el gráfico de tendencia generaba coordenadas con
   toda la precisión de punto flotante (`94.85714285714286`) — redondeado
   a 1 decimal.

---

## 9. Historia de bugs reales encontrados (para no repetirlos)

Vale la pena documentar estos porque varios son sutiles y de la clase que
"se ve bien en la revisión de código pero falla en producción":

1. **Hooks fuera de orden** (`AdminScreen.jsx`): un `useState` declarado
   *después* de un `return` condicional — React lo tolera hasta que el
   `return` condicional cambia de rama en producción, entonces crashea
   toda la pantalla. Causa raíz de un crash real reportado por el usuario
   al crear/activar una actividad.
2. **Import faltante** (`PersonasConfig.jsx`): un refactor quitó `useRef`
   de las dependencias de un componente sin darse cuenta de que el
   componente padre en el mismo archivo también lo usaba. `ReferenceError`
   inmediato al montar la pantalla. Ni el build ni los tests lo detectan
   (JS plano, sin TypeScript/ESLint en el proyecto).
3. **Elipsis fantasma en ajuste de texto**: la función de wrap-and-clamp de
   texto (usada en las tarjetas de `<canvas>`) agregaba "..." a texto que
   en realidad cabía completo en el límite de líneas — una variable
   (`current`) no se limpiaba después de un push exitoso.
4. **Regex con flag `/i` que anulaba su propio propósito**: un chequeo de
   "alternancia de mayúsculas" en el correo, con el texto ya pasado a
   minúsculas ANTES del chequeo Y con el flag `/i` en la regex — rechazaba
   cualquier correo real de 6+ letras seguidas. El bug original (sin el
   flag `/i`) ya estaba presente y era inofensivo (nunca se disparaba) en
   el código fuente del que se portó esta lógica (Full Day `Code.gs`).
5. **Impresión sin esperar la fuente**: `window.print()` se llamaba con un
   `setTimeout` fijo, sin esperar a que la fuente terminara de cargar por
   red — con la fuente de respaldo del sistema (más ancha/alta), el
   contenido se desbordaba a una segunda página en blanco.
6. **Android no respeta `print-color-adjust`** — ver §6.5/§7.4, el motivo
   por el que "imprimir" se convirtió en "descargar una imagen".
7. **Patch aplicado sobre una base desincronizada**: más de una vez un
   parche se generó contra un `HEAD` que no coincidía con lo que el
   usuario realmente tenía en su rama — causando fallos de aplicación o,
   peor, aplicaciones parciales silenciosas. Ver §2.3 para la rutina que
   lo previene.

---

## 10. Ideas evaluadas y descartadas (y por qué)

Para que un futuro agente no las vuelva a proponer sin el mismo análisis:

- **Cloud Function para fusionar identidades sin exponer WhatsApp** —
  evaluada como alternativa a exponer el WhatsApp en `personas_publico`.
  Descartada: requiere plan Blaze (tarjeta de crédito), un pipeline de
  despliegue nuevo, y mantenimiento continuo — para un problema que la
  Opción A (exponer WhatsApp, con exposición ya mínima de por sí) resuelve
  con cero infraestructura nueva. Documentado como decisión consciente de
  costo/beneficio, no un descuido de privacidad.
- **`html2canvas` / librería de PDF** — ver §7.4.
- **Recalcular grupos/mesas dentro del núcleo** — decisión explícita de
  sacarlo, preservado solo como referencia histórica si se necesita un
  patch aparte para un evento tipo cena.
- **Filtro de "sin alergia" basado en lista de palabras** (`no`, `ninguna`,
  `no tengo`...) — se intentó, nunca cubre todas las variantes reales que
  escribe la gente, así que se simplificó a guardar el texto tal cual sin
  intentar clasificarlo.
- **Algolia/Elasticsearch para el buscador** — el volumen de datos de un
  centro JAS (cientos de personas, no millones) no lo justifica; búsqueda
  100% cliente con normalización + scoring alcanza y sobra.

---

## 11. Cómo regenerar este proyecto desde cero (orden sugerido)

Si se reconstruye desde cero, este orden respeta las dependencias reales
entre features (cada fase se apoya en la anterior):

1. **Setup**: Vite + React, Firebase (Firestore + Auth), Vercel. Tokens de
   diseño (`styles/tokens.css`) primero — todo lo visual depende de esto.
2. **Auth de staff**: PIN → email/password sintético, `staff`/`pendingStaff`/
   `usernames`, reglas de Firestore para ese flujo.
3. **Modelo de actividades**: colección `activities`, Admin → Actividades
   (crear/editar/activar), reemplazar cualquier dato hardcodeado de evento.
4. **Modelo personas + inscripciones**: la separación identidad/participación
   desde el principio (no como esta app, que lo migró después) — evita la
   migración de datos que este proyecto sí tuvo que hacer.
5. **Formulario público**: campos, validación básica primero, anti-fake
   después, identidad única (`personas_publico` + confirmar "¿eres tú?")
   al final — es la parte más delicada de privacidad/UX.
6. **Recepción**: buscar + confirmar asistencia, registro manual.
7. **Admin**: dashboard, historial con gráfico de tendencia, directorio de
   personas con paginado y buscador.
8. **QR**: generación, compartir, descarga de afiche — todo en `<canvas>`
   desde el principio, no HTML+CSS impreso (ahorra el ciclo completo de
   "descubrir que Android no respeta los colores de fondo").
9. **PWA**: manifest + ícono maskable verificado + service worker mínimo.
10. **Auditoría de performance**: code-splitting por pantalla, lecturas
    diferidas, caché de lecturas puntuales — al final, con datos reales de
    uso, no como suposición temprana.

En cada fase: consultar las skills correspondientes (§2.1) **antes** de
escribir código de UI, validar con `npm run check` + `npm run build`
después de cada cambio, y para cualquier layout con texto de longitud
variable (afiches, tarjetas, títulos largos), probar con datos reales
extremos antes de darlo por terminado.
