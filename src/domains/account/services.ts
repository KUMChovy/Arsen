import { isNativeAccount, nativeAccount, type AccountState } from './native'

export async function getAccountState(): Promise<AccountState> {
  return isNativeAccount() ? nativeAccount.getState() : { status: 'unavailable' }
}

export async function signIn(email: string, password: string): Promise<AccountState> {
  if (!isNativeAccount()) return { status: 'unavailable' }
  const identifier = email.trim()
  if (!identifier || identifier.length > 320 || !password || password.length > 1024) throw new Error('Datos de acceso inválidos')
  return nativeAccount.signIn({ email: identifier, password })
}

export async function completeVerification(): Promise<AccountState> {
  return isNativeAccount() ? nativeAccount.completeVerification() : { status: 'unavailable' }
}

export async function signOut(): Promise<void> {
  if (!isNativeAccount()) throw new Error('Cuenta no disponible')
  await nativeAccount.signOut()
}
