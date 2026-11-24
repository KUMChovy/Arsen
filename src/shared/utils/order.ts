export function nextOrder(rows: Array<{ order: number }>): number {
  const order = rows.reduce((max, row) => Math.max(max, row.order), -1) + 1
  if (!Number.isSafeInteger(order) || order < 0) throw new Error('No hay un orden disponible')
  return order
}
