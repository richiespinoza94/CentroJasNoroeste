import { useMemo, useState } from 'react';
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

export default function PersonasConfig({ personas }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  function handleQueryChange(v) {
    setQuery(v);
    setPage(0);
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
            </div>
            {p.correo && <div className="personas-config__correo">{p.correo}</div>}
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
    </div>
  );
}
