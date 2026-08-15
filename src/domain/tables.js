/** Occupancy count per table, from the flat participants list. */
export function occupancyByTable(participants) {
  const occ = {};
  for (const p of participants) {
    if (p.tableId) occ[p.tableId] = (occ[p.tableId] || 0) + 1;
  }
  return occ;
}

/**
 * Table recommendation algorithm (PRD §11): filters tables this person is
 * allowed to sit at (reserved-for rules), ranks by tightest fit first so
 * assignment doesn't fragment the room, and returns the top 3.
 */
export function recommendTables(person, tables, participants) {
  const occ = occupancyByTable(participants);
  return tables
    .filter((t) => {
      if (!t.reservedFor) return true;
      if (t.reservedFor === 'staff') return person.categoria === 'staff';
      if (t.reservedFor === 'programa') return person.categoria === 'programa';
      if (t.reservedFor === 'invitado') return person.tipoParticipante === 'Invitado';
      return true;
    })
    .map((t) => ({ id: t.id, name: t.name, spacesLeft: t.capacity - (occ[t.id] || 0) }))
    .filter((t) => t.spacesLeft > 0)
    .sort((a, b) => a.spacesLeft - b.spacesLeft)
    .slice(0, 3);
}
