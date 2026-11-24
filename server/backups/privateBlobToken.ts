export function privateBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token || token === process.env.CATALOG_BLOB_READ_WRITE_TOKEN) throw new Error('Almacén privado no configurado')
  return token
}
