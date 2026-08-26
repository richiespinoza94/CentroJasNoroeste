import './FilterChips.css';

/**
 * Fila de chips de filtro con contador, con scroll horizontal si no caben.
 * Extraído de Admin → Historial — Recepción es el segundo lugar real que
 * lo necesita (mismo criterio que ui/Modal.jsx y usePagination: dos usos
 * reales, no una abstracción por si acaso).
 *
 * `options`: [{ id, label }] — label ya trae el contador armado
 * (ej. "Todos (42)"), porque cada pantalla calcula sus contadores distinto.
 */
export default function FilterChips({ options, active, onChange, ariaLabel }) {
  return (
    <div className="filter-chips" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={active === opt.id}
          className={`filter-chips__chip press${active === opt.id ? ' filter-chips__chip--active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
