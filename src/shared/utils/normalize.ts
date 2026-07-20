const accentPattern = /[\u0300-\u036f]/g
const nonWordPattern = /[^a-z0-9]+/g

export function canonicalName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(accentPattern, '')
    .replace(nonWordPattern, '-')
    .replace(/^-+|-+$/g, '')
}
