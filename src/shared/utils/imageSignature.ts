export function matchesImageSignature(mimeType: 'image/png' | 'image/jpeg' | 'image/webp', header: Uint8Array): boolean {
  const startsWith = (expected: number[], offset = 0) => header.length >= offset + expected.length && expected.every((byte, index) => header[offset + index] === byte)
  if (mimeType === 'image/png') return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (mimeType === 'image/jpeg') return startsWith([0xff, 0xd8, 0xff])
  return startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)
}
