/**
 * Table recommendation algorithm (PRD §11): filters tables this person is
 * allowed to sit at (reserved-for rules), ranks by tightest fit first so
 * assignment doesn't fragment the room, and returns the top 3.
 *
 * Reads `table.occ` directly — a counter Firestore keeps in sync with each
 * assignment inside a transaction (see firebase/collections.js) — rather
 * than recomputing occupancy by scanning every participant, so this stays
 * correct under concurrent writes instead of a snapshot that's already
 * stale by the time it renders.
 */
export function recommendTables(person, tables) {
  return tables
    .filter((t) => !t.reservedFor || t.reservedFor === person.categoria)
    .map((t) => ({ id: t.id, name: t.name, spacesLeft: t.capacity - (t.occ || 0) }))
    .filter((t) => t.spacesLeft > 0)
    .sort((a, b) => a.spacesLeft - b.spacesLeft)
    .slice(0, 3);
}
