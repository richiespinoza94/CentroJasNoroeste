import { useMemo, useState } from 'react';

/**
 * Paginado simple del lado del cliente — 15 por página es el tamaño que ya
 * se validó en Admin → Personas. Extraído aquí porque Historial es el
 * segundo lugar que necesita exactamente lo mismo (misma razón por la que
 * se extrajo ui/Modal.jsx: dos usos reales, no una abstracción por si
 * acaso).
 *
 * No resetea la página sola cuando `items` cambia — igual que ya hacía
 * Personas, es responsabilidad de quien filtra/cambia de selección llamar
 * `setPage(0)` en ese momento (ver ejemplos en PersonasConfig y
 * ActivityHistory). Mantenerlo así de simple evita una re-renderización
 * extra "mágica" por cada cambio de props.
 */
export function usePagination(items, pageSize = 15) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = useMemo(() => items.slice(currentPage * pageSize, currentPage * pageSize + pageSize), [items, currentPage, pageSize]);
  return { pageItems, page: currentPage, setPage, totalPages };
}
