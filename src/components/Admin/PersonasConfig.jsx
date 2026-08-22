import { useMemo, useRef, useState } from 'react';
import { useToast } from '../../hooks/useToast.jsx';
import { usePagination } from '../../hooks/usePagination.js';
import { updatePersona, setCategoria } from '../../firebase/collections.js';
import { ESTACAS, CATEGORIAS } from '../../domain/constants.js';
import { PencilIcon } from '../ui/Icon.jsx';
import Field from '../ui/Field.jsx';
import Modal, { useModalClose } from '../ui/Modal.jsx';
import './PersonasConfig.css';

const PAGE_SIZE = 15;

// Búsqueda inteligente 100% local (mismo patrón que el buscador de
// recepción del Full Day): normaliza acentos, compara por prefijo/substring
// sobre nombre+apellidos+estaca+barrio, y por sufijo exacto si el término
// parece un número de WhatsApp. No hace falta un motor de búsqueda externo
// — el directorio de un centro JAS es chico.
function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function scorePersona(query, persona) {
  const q = normalize(query);
  if (q.length < 3) return -1;
  const nombreCompleto = normalize(`${persona.nombre} ${persona.apellidos}`);
  const isNum = /^\d{3,}$/.test(q);
  if (isNum) return persona.whatsapp?.includes(q) ? 900 : -1;

  const estaca = normalize(persona.estaca);
  const barrio = normalize(persona.barrio);
  if (nombreCompleto === q) return 1000;
  if (nombreCompleto.startsWith(q)) return 900;
  if (nombreCompleto.split(' ').some((tok) => tok.startsWith(q))) return 800;
  if (nombreCompleto.includes(q)) return 700;
  if (estaca.includes(q) || barrio.includes(q)) return 400;
  return -1;
}

// Formulario de edición — vive dentro de <Modal>, que ya resuelve
// animación de entrada/salida, foco atrapado, Escape/click-afuera, scroll
// de fondo bloqueado y devolución de foco (ver ui/Modal.jsx). Este
// componente solo se encarga del formulario en sí; para cerrar usa
// useModalClose() en vez de que se lo pasen como prop.
//
// Sigue cubriendo (ux-ui-pro-max):
// - Si guardar falla, el modal se queda abierto con el error visible junto
//   a las acciones — nunca se descartan los cambios en silencio.
function EditPersonaForm({ persona, inscripcion, activeActivity }) {
  const requestClose = useModalClose();
  const [form, setForm] = useState({
    nombre: persona.nombre || '',
    apellidos: persona.apellidos || '',
    sexo: persona.sexo || '',
    fechaNacimiento: persona.fechaNacimiento || '',
    estaca: persona.estaca || '',
    barrio: persona.barrio || '',
    correo: persona.correo || '',
    categoria: inscripcion?.categoria || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const setField = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.apellidos.trim()) return;
    setSaving(true);
    setError('');
    try {
      await updatePersona(persona.id, form);
      if (inscripcion && form.categoria && form.categoria !== inscripcion.categoria) {
        await setCategoria(inscripcion.id, form.categoria);
      }
      requestClose(true);
    } catch (err) {
      // Se queda abierto a propósito — perder los cambios recién escritos
      // por un error de red sería peor que mostrar el error y dejar reintentar.
      setError(err.message || 'No se pudo guardar. Intenta de nuevo.');
      setSaving(false);
    }
  }

  const barrioOptions = ESTACAS[form.estaca] || [];

  return (
    <>
      <div className="personas-modal__title">Editar datos</div>
      <form onSubmit={handleSubmit} className="personas-modal__form">
        <div className="personas-modal__row">
          <Field id="editNombre" label="Nombre">
            {(a) => <input {...a} type="text" value={form.nombre} onChange={(e) => setField({ nombre: e.target.value })} />}
          </Field>
          <Field id="editApellidos" label="Apellidos">
            {(a) => <input {...a} type="text" value={form.apellidos} onChange={(e) => setField({ apellidos: e.target.value })} />}
          </Field>
        </div>
          <div className="personas-modal__row">
            <Field id="editSexo" label="Sexo">
              {(a) => (
                <select {...a} value={form.sexo} onChange={(e) => setField({ sexo: e.target.value })}>
                  <option value="">—</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              )}
            </Field>
            <Field id="editFecha" label="Fecha de nacimiento">
              {(a) => <input {...a} type="date" value={form.fechaNacimiento} onChange={(e) => setField({ fechaNacimiento: e.target.value })} />}
            </Field>
          </div>
          <Field id="editEstaca" label="Estaca">
            {(a) => (
              <select {...a} value={form.estaca} onChange={(e) => setField({ estaca: e.target.value, barrio: '' })}>
                <option value="">Elegir</option>
                {Object.keys(ESTACAS).map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
                <option value="Otra estaca">Otra estaca</option>
              </select>
            )}
          </Field>
          <Field id="editBarrio" label="Barrio / Rama">
            {(a) =>
              barrioOptions.length > 0 ? (
                <select {...a} value={form.barrio} onChange={(e) => setField({ barrio: e.target.value })}>
                  <option value="">Elegir</option>
                  {barrioOptions.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              ) : (
                <input {...a} type="text" value={form.barrio} onChange={(e) => setField({ barrio: e.target.value })} />
              )
            }
          </Field>
          <Field id="editCorreo" label="Correo" optional>
            {(a) => <input {...a} type="email" value={form.correo} onChange={(e) => setField({ correo: e.target.value })} />}
          </Field>

          {inscripcion ? (
            <Field id="editCategoria" label={`Rol en ${activeActivity?.nombre || 'la actividad activa'}`}>
              {(a) => (
                <select {...a} value={form.categoria} onChange={(e) => setField({ categoria: e.target.value })}>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : (
            <div className="personas-modal__hint">
              No está inscrito en {activeActivity ? `"${activeActivity.nombre}"` : 'la actividad activa'} — el rol se define al inscribirse.
            </div>
          )}

          {error && (
            <div className="personas-modal__error" role="alert">
              {error}
            </div>
          )}

        <div className="personas-modal__actions">
          <button type="button" className="personas-modal__cancel press" onClick={() => requestClose()} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="personas-modal__save press" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </>
  );
}

export default function PersonasConfig({ personas, participants = [], activeActivity }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const editTriggerRef = useRef(null);

  const inscripcionByWhatsapp = useMemo(() => new Map(participants.map((p) => [p.whatsapp, p])), [participants]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (q.length < 3) {
      return [...personas].sort((a, b) => `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`));
    }
    return personas
      .map((p) => ({ p, score: scorePersona(q, p) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
  }, [personas, query]);

  const { pageItems, page: currentPage, setPage, totalPages } = usePagination(filtered, PAGE_SIZE);

  function handleQueryChange(v) {
    setQuery(v);
    setPage(0);
  }

  function openEdit(p, triggerEl) {
    editTriggerRef.current = triggerEl;
    setEditing(p);
  }

  function handleClose(saved) {
    if (saved && editing) toast(`${editing.nombre}: datos actualizados.`);
    setEditing(null);
  }

  return (
    <div className="personas-config">
      <div className="personas-config__summary">{personas.length} personas registradas en total, en todas las actividades.</div>

      <input
        type="text"
        className="personas-config__search"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Buscar por nombre, estaca, barrio o WhatsApp…"
        aria-label="Buscar persona"
      />

      <div className="personas-config__list">
        {pageItems.map((p) => (
          <div key={p.id} className="personas-config__row">
            <div className="personas-config__info">
              <div className="personas-config__name">
                {p.nombre} {p.apellidos}
              </div>
              <div className="personas-config__meta">
                {p.estaca || '—'} · {p.barrio || '—'} · {p.whatsapp}
              </div>
              {p.correo && <div className="personas-config__correo">{p.correo}</div>}
            </div>
            <button
              type="button"
              className="personas-config__edit-btn press"
              aria-label={`Editar ${p.nombre} ${p.apellidos}`}
              onClick={(e) => openEdit(p, e.currentTarget)}
            >
              <PencilIcon width={16} height={16} />
            </button>
          </div>
        ))}
        {pageItems.length === 0 && <div className="personas-config__empty">Sin resultados.</div>}
      </div>

      {totalPages > 1 && (
        <div className="personas-config__pager">
          <button type="button" className="personas-config__pager-btn press" disabled={currentPage === 0} onClick={() => setPage((p) => p - 1)}>
            ← Anterior
          </button>
          <span className="personas-config__pager-label">
            Página {currentPage + 1} de {totalPages}
          </span>
          <button type="button" className="personas-config__pager-btn press" disabled={currentPage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Siguiente →
          </button>
        </div>
      )}

      {editing && (
        <Modal onClose={handleClose} triggerRef={editTriggerRef} label="Editar persona" wide>
          <EditPersonaForm persona={editing} inscripcion={inscripcionByWhatsapp.get(editing.whatsapp) || null} activeActivity={activeActivity} />
        </Modal>
      )}
    </div>
  );
}
