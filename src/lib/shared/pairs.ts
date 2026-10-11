/** Пара id в каноническом порядке (a < b) — так мэтч хранится в таблице matches. */
export function orderedPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}
