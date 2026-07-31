export function formatRepRange(repsMin: number, repsMax: number) {
  return repsMin === repsMax ? String(repsMin) : `${repsMin}-${repsMax}`
}
